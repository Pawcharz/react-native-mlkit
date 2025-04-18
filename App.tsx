import React from 'react';
import { launchImageLibrary } from 'react-native-image-picker';

import {SafeAreaView, Text, StyleSheet, View, Button} from 'react-native';
import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';

interface EmiratesIdCardFrontInfo {
  name: string,
  idNumber: string,
  nationality: string,
}

interface EmiratesIdCardBackInfo {
  sex: string,
  dateOfBirth: Date
  issueDate: Date
  expiryDate: Date
}

const ID_CARD_NUMBER_REGEX = new RegExp(/784[-]*\d{4}[-]*\d{7}[-]*\d/);
// All in lower case
const ID_CARD_NATIONALITY_PREFIX = 'nationality:';
const ID_CARD_NAME_PREFIX = 'name:';

const App = () => {

  const pickAndRecognize = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo' });

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      console.log('Selected image path:', asset.uri);

      // Use directly with ML Kit:
      const recognitionResult = await TextRecognition.recognize(asset.uri);
      console.log('Recognized text:', recognitionResult);
    } else {
      console.log('No image selected.');
    }
  };

  const extractDataFromIdFront = (ocrResult: TextRecognitionResult): EmiratesIdCardFrontInfo | null => {

    // Check is it United Arab Emirates
    if (!ocrResult.text.toLowerCase().includes('united arab emirates')) {

      return null;
    }

    const name = ocrResult.blocks.find(block => block.text.toLowerCase().includes(ID_CARD_NAME_PREFIX))?.text.split(ID_CARD_NAME_PREFIX)?.[1] || '';

    const idNumber = ocrResult.text.match(ID_CARD_NUMBER_REGEX)?.[0] || '';

    const nationality = ocrResult.blocks.find(block => block.text.toLowerCase().includes(ID_CARD_NATIONALITY_PREFIX))?.text.toLowerCase().split(ID_CARD_NATIONALITY_PREFIX)?.[1].trim() || '';

    const frontInfo: EmiratesIdCardFrontInfo = {
      name,
      idNumber,
      nationality,
    };

    return frontInfo;
  };

  const extractDataFromIdBack = (ocrResult: TextRecognitionResult): EmiratesIdCardBackInfo | null => {
    console.log(ocrResult);

    const backInfo: EmiratesIdCardBackInfo = {
      sex: '',
      dateOfBirth: new Date(),
      issueDate: new Date(),
      expiryDate: new Date(),
    };

    return backInfo;
  };

  const pickAndRecognizeUAEIdCard = async () => {

    // // Get front of the id card
    // const frontResult = await launchImageLibrary({ mediaType: 'photo' });

    // if (frontResult.assets && frontResult.assets.length > 0) {
    //   const asset = frontResult.assets[0];

    //   // Use directly with ML Kit:
    //   const recognitionResult = await TextRecognition.recognize(asset.uri);

    //   const idCardFrontInfo = extractDataFromIdFront(recognitionResult);

    //   console.log('idCardFrontInfo: ', idCardFrontInfo);
    // } else {
    //   console.log('No image selected.');
    // }

    // Get back of the id card
    const backResult = await launchImageLibrary({ mediaType: 'photo' });

    if (backResult.assets && backResult.assets.length > 0) {
      const asset = backResult.assets[0];

      // Use directly with ML Kit:
      const recognitionResult = await TextRecognition.recognize(asset.uri);

      const idCardBackInfo = extractDataFromIdBack(recognitionResult);

      console.log('idCardBackInfo: ', idCardBackInfo);
    } else {
      console.log('No image selected.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MLKit Demo App</Text>
        <Text style={styles.subtitle}>Welcome to the future of mobile AI ✨</Text>
        <Button title="test" onPress={pickAndRecognizeUAEIdCard} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: {fontSize: 24, fontWeight: 'bold'},
  subtitle: {fontSize: 16, color: '#777', marginTop: 10},
});

export default App;
