import React from 'react';
import { launchImageLibrary } from 'react-native-image-picker';

import {SafeAreaView, Text, StyleSheet, View, Button} from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';

const App = () => {

  const pickAndRecognize = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo' });

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      console.log('Selected image path:', asset.uri);

      // Use directly with ML Kit:
      const recognitionResult = await TextRecognition.recognize(asset.uri);
      console.log('Recognized text: \n', recognitionResult.text);
    } else {
      console.log('No image selected.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MLKit Demo App</Text>
        <Text style={styles.subtitle}>Welcome to the future of mobile AI ✨</Text>
        <Button title="test" onPress={pickAndRecognize} />
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
