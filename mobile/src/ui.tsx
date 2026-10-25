import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C, R, SPACE} from './theme';

export function Page({children,style}:ViewProps){return <SafeAreaView edges={['top']} style={s.safe}><View style={[s.page,style]}>{children}</View></SafeAreaView>}
export function Heading({eyebrow,title,subtitle}:{eyebrow?:string;title:string;subtitle?:string}){return <View style={s.heading}>{eyebrow?<Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>:null}<Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}</View>}
export function Card({children,style}:ViewProps){return <View style={[s.card,style]}>{children}</View>}
export function Button({title,onPress,kind='primary',disabled=false,loading=false,small=false}:{title:string;onPress:()=>void;kind?:'primary'|'secondary'|'danger'|'quiet';disabled?:boolean;loading?:boolean;small?:boolean}){
  const isPrimary=kind==='primary',isDanger=kind==='danger',isSecondary=kind==='secondary';
  const bg=isPrimary?C.plum:isDanger?C.red:isSecondary?C.white:'transparent';
  const color=isPrimary||isDanger?C.white:isSecondary?C.ink:C.plum;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:disabled||loading}} onPress={onPress} disabled={disabled||loading} style={({pressed})=>[s.button,{backgroundColor:bg,borderColor:isPrimary?C.plumDeep:isDanger?C.red:isSecondary?C.line:'transparent',opacity:disabled?.52:pressed?.88:1,minHeight:small?44:50,paddingHorizontal:small?13:16},(isPrimary||isDanger)&&s.buttonRaised,isSecondary&&s.buttonSecondary]}>
    {loading?<ActivityIndicator color={color}/>:<Text maxFontSizeMultiplier={1.4} style={{color,fontWeight:'700',fontSize:small?13:15,lineHeight:20,textAlign:'center'}}>{title}</Text>}
  </Pressable>
}
export function Field({label,...props}:TextInputProps&{label:string}){return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={C.muted} selectionColor={C.plum} {...props} style={[s.input,props.multiline&&s.multiline,props.style]}/></View>}
export function Pill({text,tone='neutral'}:{text:string;tone?:'neutral'|'green'|'amber'|'red'}){const colors=tone==='green'?[C.mint,C.teal]:tone==='amber'?[C.amberPale,C.amber]:tone==='red'?[C.redPale,C.red]:['#F1EDF1',C.muted];return <View accessibilityLabel={text} style={[s.pill,{backgroundColor:colors[0]}]}><Text maxFontSizeMultiplier={1.3} style={{fontSize:10,fontWeight:'800',letterSpacing:.35,color:colors[1]}}>{text}</Text></View>}
export function Notice({children,tone='info'}:{children:React.ReactNode;tone?:'info'|'warn'|'good'}){return <View style={[s.notice,{backgroundColor:tone==='warn'?C.amberPale:tone==='good'?C.mint:C.surface,borderLeftColor:tone==='warn'?C.amber:tone==='good'?C.teal:C.lavender}]}><Text style={{fontSize:13,color:tone==='warn'?C.amber:tone==='good'?C.teal:C.muted,lineHeight:20}}>{children}</Text></View>}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.paper},
  page:{flex:1,paddingHorizontal:18,paddingTop:12},
  heading:{marginBottom:18},
  eyebrow:{fontSize:10,letterSpacing:1.5,color:C.plum,fontWeight:'800',marginBottom:6},
  title:{fontSize:25,lineHeight:31,fontWeight:'800',letterSpacing:-.45,color:C.ink},
  subtitle:{fontSize:14,color:C.muted,lineHeight:21,marginTop:6,maxWidth:560},
  card:{backgroundColor:C.white,borderColor:C.line,borderWidth:1,borderRadius:R.card,padding:17,marginBottom:14,elevation:2,shadowColor:C.shadow,shadowOpacity:.055,shadowRadius:12,shadowOffset:{width:0,height:4}},
  button:{borderRadius:R.control,paddingVertical:12,justifyContent:'center',alignItems:'center',marginBottom:7,borderWidth:1},
  buttonRaised:{elevation:2,shadowColor:C.shadow,shadowOpacity:.14,shadowRadius:5,shadowOffset:{width:0,height:2}},
  buttonSecondary:{backgroundColor:'#FFFEFC'},
  field:{marginBottom:14},
  label:{fontSize:12,fontWeight:'700',color:C.ink,marginBottom:6},
  input:{borderWidth:1,borderColor:'#D8CED8',borderRadius:R.control,backgroundColor:'#FFFEFC',paddingHorizontal:14,paddingVertical:12,color:C.ink,fontSize:15,minHeight:48},
  multiline:{minHeight:98,textAlignVertical:'top',paddingTop:13},
  pill:{borderRadius:R.pill,paddingHorizontal:11,paddingVertical:6,alignSelf:'flex-start'},
  notice:{borderRadius:14,borderLeftWidth:3,padding:13,marginVertical:9},
});
