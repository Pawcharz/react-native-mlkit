import React from 'react';
import { launchImageLibrary } from 'react-native-image-picker';

import {SafeAreaView, Text, StyleSheet, View, Button} from 'react-native';
import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';

import { OpenCV } from 'react-native-fast-opencv';
import RNFS from 'react-native-fs';

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
          console.log('wrong format')
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
          }
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

  async function straightenDocument(imagePath: string): Promise<string> {
    // Load image
    const mat = await OpenCV.imread(imagePath);

    // Convert to grayscale
    const gray = await OpenCV.cvtColor(mat, OpenCV.ColorConversionCodes.COLOR_RGBA2GRAY);

    // Blur to reduce noise
    const blurred = await OpenCV.GaussianBlur(gray, [5, 5], 0);

    // Edge detection
    const edges = await OpenCV.Canny(blurred, 75, 200);

    // Find contours
    const contours = await OpenCV.findContours(edges, OpenCV.RetrievalModes.RETR_LIST, OpenCV.ContourApproximationModes.CHAIN_APPROX_SIMPLE);

    // Find biggest rectangle-like contour (4 points)
    let docContour = null;
    for (const contour of contours) {
      const peri = await OpenCV.arcLength(contour, true);
      const approx = await OpenCV.approxPolyDP(contour, 0.02 * peri, true);
      if (approx.length === 4) {
        docContour = approx;
        break;
      }
    }

    if (!docContour) throw new Error('No document detected');

    // Order the 4 points correctly
    const rect = orderPoints(docContour); // implement this helper

    // Compute transform matrix and warp
    const [tl, tr, br, bl] = rect;
    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const maxWidth = Math.max(widthTop, widthBottom);

    const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
    const maxHeight = Math.max(heightLeft, heightRight);

    const dstPoints = [
      { x: 0, y: 0 },
      { x: maxWidth - 1, y: 0 },
      { x: maxWidth - 1, y: maxHeight - 1 },
      { x: 0, y: maxHeight - 1 },
    ];

    const M = await OpenCV.getPerspectiveTransform(rect, dstPoints);
    const warped = await OpenCV.warpPerspective(mat, M, [maxWidth, maxHeight]);

    console.log(warped)

    // Save to file
    const savedPath = `${RNFS.CachesDirectoryPath}/corrected.jpg`;
    await OpenCV.imwrite(savedPath, warped);

    return savedPath;
  }

  const pickAndStraighten = async () => {
    console.log('saass')
    const backResult = await launchImageLibrary({ mediaType: 'photo' });
    console.log('saass')

    if (backResult.assets && backResult.assets.length > 0) {
      const asset = backResult.assets[0];

      const filePath = await straightenDocument(asset.uri);
    } else {
      console.log('No image selected.');
    }
  }


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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MLKit Demo App</Text>
        <Text style={styles.subtitle}>Welcome to the future of mobile AI ✨</Text>
        <Button title="straighten" onPress={pickAndStraighten} />
        <Button title="scan" onPress={pickAndRecognizeUAEIdCard} />
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
