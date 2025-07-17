import { StyleSheet } from 'react-native';

const getGlobalStyles = (colorScheme) => {
  return StyleSheet.create({
    DarkGreyOrLightGrey: {
      color: colorScheme === 'dark' ? '#c5c7c6' : '#292a2c',
    },
    LightGreyOrDarkGrey: {
      color: colorScheme === 'dark' ? '#292a2c' : '#f0f0f0',
    },
    WhiteOrBlack: {
      color: colorScheme === 'dark' ? '#000000' : '#ffffff',
    },
    BlackOrwhite: {
      color: colorScheme === 'dark' ? '#ffffff' : '#000000',
    },
    mainBackgroundColor: {
      color: colorScheme === 'dark' ? '#131313' : '#ffffff',
    },
    WhiteOrDarkGrey: {
      color: colorScheme === 'dark' ? '#292a2c' : '#ffffff',
    },
    itemTextColor: {
      color: colorScheme === 'dark' ? '#f0f0f0' : 'black',
    },
    mainColor: {
      color: colorScheme === 'dark' ? '#aa7cd4' : '#5B2A86',
    },
    mainColorOnly: {
      color:'#5b2a86'
    },
    brightMainColor: {
      color: colorScheme === 'dark' ? '#5b2a86' : '#bb94de',
    },
    darkColor: {
      color: '#360568',
    },
    notOccupiedColor: {
      color: colorScheme === 'dark' ? '#292a2c' : '#eae8f4',
    },
    occupiedColor: {
      color: '#7785ac'
    },
    sectiontitlefontsize: {
      fontSize: 15,
    },
    container: {
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
      padding: 20,
    },
    containerManage: {
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
      padding: 15,
    },
    containerFriends: {
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
    },
    scrollview: {
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
    },
    containersecondary: {
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
      padding: 20,
      paddingTop: 100,
    },
    login: {
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
      padding: 20,
    },
    text: {
      color: colorScheme === 'dark' ? '#ffffff' : '#000000',
    },
    title: {
      fontSize: 25,
      color: colorScheme === 'dark' ? '#ffffff' : '#4CAF50',
    },
    welcometext: {
      fontSize: 20,
      color: colorScheme === 'dark' ? '#ffffff' : '#4CAF50',
    },
    navigation: {
      backgroundColor: colorScheme === 'dark' ? '#000000' : '#4CAF50',
    },
    navbuttons: {
      color: colorScheme === 'dark' ? '#000000' : '#4CAF50',
    },
    backbutton: {
      color: colorScheme === 'dark' ? '#000000' : '#ffffff',
      position: 'absolute',
      top: 40,
      left: 20,
      zIndex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    navText: {
      fontSize: 16,
      color: colorScheme === 'dark' ? '#000000' : '#ffffff',
    },
    headerText: {
      fontSize: 16,
      color: colorScheme === 'dark' ? '#ffffff' : '#4CAF50',
    },
    navTextopposite: {
      fontSize: 16,
      color: colorScheme === 'dark' ? '#ffffff' : '#000000',
      marginLeft: 10,
    },
    navbuttonsopposite: {
      color: colorScheme === 'dark' ? '#ffffff' : '#000000',
    },
    sectionTitle: {
      fontSize: 15,
      marginBottom: 10,
      textAlign: 'left',
      marginLeft: 10,
    },
  });
};

export default getGlobalStyles;
