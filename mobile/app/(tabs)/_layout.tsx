import React from 'react';
import {Tabs} from 'expo-router';
import {Text, View} from 'react-native';
import {C} from '../../src/theme';

const icons:Record<string,string>={index:'⌂',safety:'⌖',digital:'◇',evidence:'▤',profile:'♡'};
const titles:Record<string,string>={index:'Home',safety:'Safety',digital:'Digital',evidence:'Evidence',profile:'Profile'};
export default function TabsLayout(){
  return <Tabs screenOptions={({route})=>({
    headerShown:false,
    tabBarActiveTintColor:C.plum,
    tabBarInactiveTintColor:C.muted,
    tabBarStyle:{height:76,paddingTop:7,paddingBottom:8,backgroundColor:C.nav,borderTopColor:C.line,borderTopWidth:1,elevation:14,shadowColor:C.shadow,shadowOpacity:.08,shadowRadius:10,shadowOffset:{width:0,height:-3}},
    tabBarLabelStyle:{fontSize:10,fontWeight:'700',marginTop:1},
    tabBarIcon:({color,focused})=><View style={{minWidth:34,height:29,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:focused?C.plumPale:'transparent'}}><Text accessibilityLabel={`${titles[route.name]} tab`} style={{fontSize:20,fontWeight:'700',color}}>{icons[route.name]||'•'}</Text></View>,
  })}>
    <Tabs.Screen name="index" options={{title:'Home',tabBarAccessibilityLabel:'Home tab'}}/>
    <Tabs.Screen name="safety" options={{title:'Safety',tabBarAccessibilityLabel:'Safety map tab'}}/>
    <Tabs.Screen name="digital" options={{title:'Digital',tabBarAccessibilityLabel:'Digital safety tab'}}/>
    <Tabs.Screen name="evidence" options={{title:'Evidence',tabBarAccessibilityLabel:'Evidence vault tab'}}/>
    <Tabs.Screen name="profile" options={{title:'Profile',tabBarAccessibilityLabel:'Profile and privacy tab'}}/>
  </Tabs>;
}
