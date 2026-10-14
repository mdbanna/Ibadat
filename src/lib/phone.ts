// The phone helpers live next to the Edge Functions so the browser and the server can never disagree about how a phone
// number becomes a login. Re-exported here for the app.
export * from '../../supabase/functions/_shared/phone'
