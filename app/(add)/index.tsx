import getGlobalStyles from '../globalStyles';
import React from 'react';
import { View, Text, useColorScheme, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function Add() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [isEmpty, setIsEmpty] = React.useState(true);

  const handleNext = () => {
    if (!isEmpty) {
      router.push({
        pathname: '/(add)/details',
        params: { name },
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <MaterialIcons
          name="close"
          size={28}
          color={globalStyles.BlackOrwhite.color}
        />
      </TouchableOpacity>
      <Text style={{marginTop: 100, marginLeft: 20, fontSize: 25, color: globalStyles.BlackOrwhite.color}}>Add new item</Text>
      <Text style={{ marginTop: 40, marginLeft: 20, marginRight: 40, color: globalStyles.DarkGreyOrLightGrey.color}}>Start by choosing a name</Text>
      <View style={{marginHorizontal: 20, marginTop: 10}}>
        <TextInput
          style={[styles.input, {color: globalStyles.BlackOrwhite.color}]}
          placeholder="Type the name here..."
          placeholderTextColor={globalStyles.DarkGreyOrLightGrey.color}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setIsEmpty(text.trim() === '');
          }}
        />
      </View>
      {isEmpty && <Text style={[styles.warningText, styles.centeredWarning]}>A name is mandatory</Text>}
      <TouchableOpacity
        style={[styles.nextButton, {backgroundColor: globalStyles.brightMainColor.color}, isEmpty && styles.disabledButton]}
        onPress={handleNext}
        disabled={isEmpty}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 60,
    width: '100%',
    borderWidth: 1,
    borderColor: 'grey',
    paddingHorizontal: 15,
    fontSize: 20,
    borderRadius: 5,
    marginRight: 20,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
  centeredWarning: {
    textAlign: 'center',
  },
  nextButton: {
    position: 'absolute',
    top: 330,
    right: 30,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    elevation: 5,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    color: 'red',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: 'gray',
    opacity: 0.7, 
  },
});