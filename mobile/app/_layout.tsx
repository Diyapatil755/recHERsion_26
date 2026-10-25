import 'react-native-gesture-handler';
import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppProvider} from '../src/store';
import {C} from '../src/theme';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export default function RootLayout(){return <SafeAreaProvider><AppProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:C.paper},animation:'fade_from_bottom',gestureEnabled:true}}/></AppProvider></SafeAreaProvider>}
