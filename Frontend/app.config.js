// Dynamic config layered over app.json.
//
// google-services.json is gitignored, and EAS Build only uploads files git
// tracks — so the file is stored as the EAS secret file variable
// GOOGLE_SERVICES_JSON and injected at build time. A static app.json cannot
// read that: "$GOOGLE_SERVICES_JSON" there is taken as a literal filename,
// which is why two builds failed with "google-services.json is missing".
// Only a dynamic config can resolve process.env, hence this file.
//
// Locally (Expo Go, prebuild) the variable is unset and the real file on disk
// is used instead.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
