import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../middleware/adminAuth';
import {
  notifyCustomerWelcome,
  notifyGroupEnrolment,
  type SendOutcome,
} from '../whatsapp/proactiveNotifications';

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function notificationMessage(outcome: SendOutcome): string {
  switch (outcome) {
    case 'sent': return 'WhatsApp notification sent.';
    case 'duplicate': return 'WhatsApp notification was already sent.';
    case 'skipped_optout': return 'WhatsApp was not sent because customer consent is not active.';
    default: return 'WhatsApp was not sent. Check the approved template and backend configuration.';
  }
}

export const adminCustomerLifecycleRouter = Router();

/** Create a customer from an authenticated admin and send one welcome notice. */
adminCustomerLifecycleRouter.post('/customers', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = getAdmin();
  if (!admin) return res.status(503).json({ error: 'Customer service is not configured.' });

  const body = req.body ?? {};
  const customerType = body.customerType === 'Company' ? 'Company' : body.customerType === 'Individual' ? 'Individual' : '';
  const fullName = text(body.fullName, 160);
  const phone = text(body.phone, 20).replace(/\D/g, '').slice(-10);
  const email = text(body.email, 254).toLowerCase();
  const age = body.age === null || body.age === undefined || body.age === '' ? null : Number(body.age);
  const panNumber = text(body.panNumber, 10).toUpperCase();
  const aadhaar = text(body.aadhaar, 12).replace(/\D/g, '');
  const gstin = text(body.gstin, 15).toUpperCase();
  const city = text(body.city, 100);
  const state = text(body.state, 100);
  const postalCode = text(body.postalCode, 6).replace(/\D/g, '');
  const whatsappOptIn = body.whatsappOptIn === true;

  if (!customerType || !fullName || !/^\d{10}$/.test(phone) || !city || !state) {
    return res.status(400).json({ error: 'Customer type, name, 10-digit mobile number, city and state are required.' });
  }
  if (email && !EMAIL.test(email)) return res.status(400).json({ error: 'Email address is invalid.' });
  if (age !== null && (!Number.isInteger(age) || age < 18 || age > 120)) {
    return res.status(400).json({ error: 'Age must be a whole number between 18 and 120.' });
  }
  if (panNumber && !PAN.test(panNumber)) return res.status(400).json({ error: 'PAN number is invalid.' });
  if (customerType === 'Individual' && aadhaar && !/^\d{12}$/.test(aadhaar)) {
    return res.status(400).json({ error: 'Aadhaar number is invalid.' });
  }
  if (customerType === 'Company' && gstin && !GSTIN.test(gstin)) {
    return res.status(400).json({ error: 'GSTIN is invalid.' });
  }
  if (postalCode && !/^\d{6}$/.test(postalCode)) {
    return res.status(400).json({ error: 'Postal code is invalid.' });
  }

  const now = new Date().toISOString();
  const { data: customer, error } = await admin
    .from('customers')
    .insert({
      customer_type: customerType,
      full_name: fullName,
      phone,
      email: email || null,
      age,
      gender: customerType === 'Individual' ? text(body.gender, 40) || null : null,
      gstin_number: customerType === 'Company' ? gstin || null : null,
      address_line1: text(body.addressLine1, 250) || null,
      address_line2: text(body.addressLine2, 250) || null,
      city,
      state,
      postal_code: postalCode || null,
      aadhar_number: aadhaar || null,
      pan_number: panNumber || null,
      notes: text(body.notes, 2000) || null,
      kyc_status: 'pending',
      whatsapp_opt_in: whatsappOptIn,
      whatsapp_opt_in_at: whatsappOptIn ? now : null,
      whatsapp_opt_out_at: null,
    })
    .select('id, customer_id')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return res.status(409).json({ error: 'A customer with this mobile number already exists.' });
    }
    console.error('[Admin customer] create failed:', error.message);
    return res.status(500).json({ error: 'Failed to create customer.' });
  }

  const notification = await notifyCustomerWelcome(customer.id);
  return res.status(201).json({
    ok: true,
    customerId: customer.id,
    customerCode: customer.customer_id,
    notification,
    notificationMessage: notificationMessage(notification),
  });
});

/** Enrol an existing customer and send one group-enrolment notice. */
adminCustomerLifecycleRouter.post('/group-members', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = getAdmin();
  if (!admin) return res.status(503).json({ error: 'Membership service is not configured.' });

  const groupId = text(req.body?.groupId, 36);
  const customerId = text(req.body?.customerId, 36);
  const participationType = req.body?.participationType === 'half' ? 'half' : req.body?.participationType === 'full' ? 'full' : '';
  const whatsappOptInConfirmed = req.body?.whatsappOptInConfirmed === true;
  if (!UUID.test(groupId) || !UUID.test(customerId) || !participationType) {
    return res.status(400).json({ error: 'Valid group, customer and participation type are required.' });
  }

  const participationShare = participationType === 'half' ? 0.5 : 1;
  const { data: member, error } = await admin
    .from('chit_members')
    .insert({
      chit_group_id: groupId,
      customer_id: customerId,
      participation_type: participationType,
      participation_share: participationShare,
    })
    .select('id, ticket_number')
    .single();

  if (error) {
    const lower = error.message.toLowerCase();
    if ((error as any).code === '23505') {
      return res.status(409).json({ error: 'This customer is already enrolled in the group.' });
    }
    if ((error as any).code === '23514' || lower.includes('capacity')) {
      return res.status(409).json({ error: 'The chit group does not have enough remaining capacity.' });
    }
    console.error('[Admin membership] create failed:', error.message);
    return res.status(500).json({ error: 'Failed to enrol customer.' });
  }

  if (whatsappOptInConfirmed) {
    const { error: consentError } = await admin
      .from('customers')
      .update({
        whatsapp_opt_in: true,
        whatsapp_opt_in_at: new Date().toISOString(),
        whatsapp_opt_out_at: null,
      })
      .eq('id', customerId);
    if (consentError) {
      console.warn('[Admin membership] consent update failed:', consentError.message);
    }
  }

  const notification = await notifyGroupEnrolment(member.id);
  return res.status(201).json({
    ok: true,
    memberId: member.id,
    ticketNumber: member.ticket_number,
    notification,
    notificationMessage: notificationMessage(notification),
  });
});
