import type { ExpoConfig } from 'expo/config';
const mapsKey=process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY||'';
export default ():ExpoConfig=>({
 name:'Saheli',slug:'saheli-mobile',version:'1.0.0',scheme:'saheli',orientation:'portrait',userInterfaceStyle:'light',
 ios:{supportsTablet:true,bundleIdentifier:'com.saheli.safety'},
 android:{package:'com.saheli.safety',config:{googleMaps:{apiKey:mapsKey}}},
 plugins:['expo-router','expo-status-bar',['expo-location',{locationWhenInUsePermission:'Saheli uses your location only when you request a location-aware safety action.'}],['expo-notifications',{color:'#6c3f5b',defaultChannel:'safety-reminders'}],'expo-secure-store',['expo-sqlite',{useSQLCipher:true}],'expo-document-picker','expo-sharing','@react-native-community/datetimepicker',['react-native-maps',{androidGoogleMapsApiKey:mapsKey}]],
 extra:{googleMapsApiKey:mapsKey,supabaseUrl:process.env.EXPO_PUBLIC_SUPABASE_URL||'',supabaseAnonKey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||''}
});
