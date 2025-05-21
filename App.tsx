import React, { useCallback, useEffect, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';

import {SafeAreaView, Text, StyleSheet, View, Button, PermissionsAndroid, Platform} from 'react-native';
import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';

import DocumentScanner from 'react-native-document-scanner-plugin';

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

type TD1MRZData = {
  documentType: string;
  issuingCountry: string;
  documentNumber: string;
  documentNumberCheckDigit: string;
  optionalData1: string;
  birthDate: Date;
  birthDateCheckDigit: string;
  sex: string;
  expirationDate: Date;
  expirationDateCheckDigit: string;
  nationality: string;
  optionalData2: string;
  names: { surname: string; givenNames: string[] };
};

const ID_CARD_NUMBER_REGEX = new RegExp(/784[-]*\d{4}[-]*\d{7}[-]*\d/);
// All in lower case
const ID_CARD_NATIONALITY_PREFIX = 'nationality:';
const ID_CARD_NAME_PREFIX = 'name:';

const App = () => {

  const parseTD1MRZ = (lines: string[]): TD1MRZData => {
      if (lines.length !== 3 || lines.some(line => line.length !== 30)) {
          console.log('wrong format');
          throw new Error('Invalid TD1 MRZ format: must have 3 lines of 30 characters each.');
      }

      const [line1, line2, line3] = lines;

      const namesRaw = line3.split('<<');
      const surname = namesRaw[0].replace(/<+/g, ' ').trim();
      const givenNames = namesRaw.slice(1).join(' ').replace(/<+/g, ' ').trim().split(/\s+/);

      const currentYearEnd = new Date().getFullYear().toString().substring(2, 4);

      // Birth Day
      const birthDateStr = line2.substring(0, 6);
      const birthYearEnd = birthDateStr.substring(0, 2);

      // FIX - Replace with full date check
      const birthYear = Number(Number(birthYearEnd) > Number(currentYearEnd) ? '19' + birthYearEnd : '20' + birthYearEnd);

      const birthDate = new Date(`${birthYear}-${birthDateStr.substring(2, 4)}-${birthDateStr.substring(4, 6)}`);

      console.log('birthDate: ', birthDate.toString());

      // Expiration Date

      const expDateStr = line2.substring(8, 14);
      const expYearEnd = expDateStr.substring(0, 2);

      // FIX - Replace with full date check
      const expYear = Number(Number(expYearEnd) > Number(currentYearEnd) ? '19' + expYearEnd : '20' + expYearEnd);

      const expirationDate = new Date(`${expYear}-${expDateStr.substring(2, 4)}-${expDateStr.substring(4, 6)}`);

      console.log('expirationDate: ', expirationDate.toString());

      return {
          documentType: line1.substring(0, 2).replace(/</g, ''),
          issuingCountry: line1.substring(2, 5),
          documentNumber: line1.substring(5, 14).replace(/</g, ''),
          documentNumberCheckDigit: line1[14],
          optionalData1: line1.substring(15, 30).replace(/</g, ''),
          birthDate: birthDate,
          birthDateCheckDigit: line2[6],
          sex: line2[7],
          expirationDate: expirationDate,
          expirationDateCheckDigit: line2[14],
          nationality: line2.substring(15, 18),
          optionalData2: line2.substring(18, 29).replace(/</g, ''),
          names: {
              surname,
              givenNames,
          },
      };
  };


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

  // TODO - REMOVE, MRZ should be enough
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

    const mrzCode = ocrResult.text.split('\n').slice(-3).map(line => line.replaceAll(' ', ''));

    console.log('mrzCode: ', mrzCode);
    const result = parseTD1MRZ(mrzCode);

    console.log('result: ', result);

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

      // console.log('idCardBackInfo: ', idCardBackInfo);
    } else {
      console.log('No image selected.');
    }
  };

  const [scannedImage, setScannedImage] = useState();

  async function requestCameraPermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  const requestStoragePermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const sdkInt = Platform.Version;
        console.log('Android SDK:', sdkInt);
        if (sdkInt >= 33) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          ]);

          return (
            granted['android.permission.READ_MEDIA_IMAGES'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } else {
        return true; // iOS doesn't need runtime permission for photos
      }
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const scanDocument = useCallback(async () => {
    if (Platform.OS === 'android') {
      const grantedCamera = await requestCameraPermission();
      if (!grantedCamera) {
        console.warn('Camera permission not granted');
        return;
      }

      const grantedStorage = await requestStoragePermission();
      if (!grantedStorage) {
        console.warn('Storage permission not granted');
        return;
      }
    }

    const { scannedImages } = await DocumentScanner.scanDocument();

    if (scannedImages.length > 0) {
      const imagePath = scannedImages[0];
      setScannedImage(imagePath);

      try {
        console.log('Scanning image: ', imagePath);
        const recognitionResult = await TextRecognition.recognize(imagePath);
        console.log('Recognized text from scanned image:', recognitionResult.text);
      } catch (error) {
        console.error('Text recognition failed:', error);
      }
    } else {
      console.warn('No scanned image returned');
    }
  }, []);

  // useEffect(() => {
  //   // call scanDocument on load
  //   scanDocument();
  // }, [scanDocument]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MLKit Demo App</Text>
        <Text style={styles.subtitle}>Welcome to the future of mobile AI ✨</Text>
        <Button title="Scan (memory)" onPress={pickAndRecognizeUAEIdCard} />
        <Button title="Scan Document" onPress={scanDocument} />
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
