const appJson = require('./app.json');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

module.exports = () => ({
  expo: {
    ...appJson.expo,
    web: {
      ...appJson.expo.web,
      bundler: 'metro',
      output: 'static',
    },
    extra: {
      ...appJson.expo.extra,
      supabaseUrl,
      supabaseAnonKey,
    },
  },
});
