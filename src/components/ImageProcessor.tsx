import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import RNFS from 'react-native-fs';
import { OpenCV, ColorConversionCodes, ObjectType, Size, InterpolationFlags, MorphTypes, MorphShapes, ContourApproximationModes, RetrievalModes, PointVector, Point } from 'react-native-fast-opencv';

type Props = {
  imagePath: string;
};

const MAX_WIDTH = 720;
const MAX_HEIGHT = 1280;

// 1. Convert image to grayscale
// 2. Apply blur to reduce noise
// 3. Use Canny edge detection to get edges
// 4. Find contours in edge image
// 5. Find the contour with 4 corners and largest area (likely the document)
// 6. Sort the 4 points in consistent order (top-left, top-right, bottom-right, bottom-left)
// 7. Define destination points (rectangle of expected output size)
// 8. Calculate perspective transform matrix (if getPerspectiveTransform unavailable, precompute in JS or Python or use library helper)
// 9. Apply warpPerspective with matrix to get corrected image
// 10. Display the result

export default function ImageProcessor({ imagePath }: Props) {
  const [processedImageBase64, setProcessedImageBase64] = useState<string | null>(null);

  useEffect(() => {
    async function processImage() {
      console.log('-- Updates image --');
      try {
        // 1. Read image as base64 string
        const base64 = await RNFS.readFile(imagePath, 'base64');

        const source = OpenCV.base64ToMat(base64);

        // 2. Resize image for other transformations to be universally accurate
        const resizeKernel = OpenCV.createObject(ObjectType.Size, MAX_HEIGHT, MAX_WIDTH);
        OpenCV.invoke('resize', source, source, resizeKernel, 0, 0, InterpolationFlags.INTER_AREA);

        // 3. Convert to grayscale
        OpenCV.invoke('cvtColor', source, source, ColorConversionCodes.COLOR_BGR2GRAY);

        // 4. Remove noise
        const kernel = OpenCV.createObject(ObjectType.Size, 4, 4);
        const structuringElement = OpenCV.invoke(
          'getStructuringElement',
          MorphShapes.MORPH_ELLIPSE,
          kernel,
        );
        OpenCV.invoke(
          'morphologyEx',
          source,
          source,
          MorphTypes.MORPH_OPEN,
          structuringElement,
        );

        // 5. Apply blur (let's say 5x5 kernel)
        const blurKernel = OpenCV.createObject(ObjectType.Size, 15, 15);
        OpenCV.invoke('GaussianBlur', source, source, blurKernel, 0);


        OpenCV.invoke('Canny', source, source, 0, 20);

        const processedBase64 = OpenCV.toJSValue(source).base64;

        // 6. Select contours
        const contours = OpenCV.createObject(ObjectType.PointVectorOfVectors);
        OpenCV.invoke(
          'findContours',
          source,
          contours,
          RetrievalModes.RETR_LIST,
          ContourApproximationModes.CHAIN_APPROX_SIMPLE,
        );
        const contoursMats = OpenCV.toJSValue(contours);
        console.log(contoursMats);

        // console.log(contoursMats.array.sort((a, b) => b.length - a.length).slice(0, 10))

        // 7. Selecting areas
        let greatestPolygon: PointVector | undefined;
        let greatestArea = 0;

        for (let index = 0; index < contoursMats.array.length; index++) {
          const contour = OpenCV.copyObjectFromVector(contours, index);
          const {value: area} = OpenCV.invoke('contourArea', contour, false);

          if (area > 100 && area > greatestArea) {
            const peri = OpenCV.invoke('arcLength', contour, true);
            const approx = OpenCV.createObject(ObjectType.PointVector);

            OpenCV.invoke('approxPolyDP', contour, approx, 0.1 * peri.value, true);

            greatestPolygon = approx;
            greatestArea = area;
          }
        }
        console.log(greatestPolygon, greatestArea);

        if (greatestPolygon) {
          const points = OpenCV.toJSValue(greatestPolygon).array;
          console.log(points);

          if (points.length === 4) {
            // const contourVector = OpenCV.createObject(ObjectType.MatVector);
            const pointObjs = points.map(pt => OpenCV.createObject(ObjectType.Point2f, pt.x, pt.y));
            const pointVec = OpenCV.createObject(ObjectType.Point2fVector, pointObjs);
            const color = { r: 0, g: 255, b: 0, a: 255 }; // green with full opacity
            const thickness = 3;
            const isClosed = true;

            
            OpenCV.invoke('polylines', source, pointVec, isClosed, color, thickness);
          }
        }

        setProcessedImageBase64(`data:image/png;base64,${processedBase64}`);

        OpenCV.clearBuffers();
      } catch (e) {
        console.error('Error processing image:', e);
      }
    }

    processImage();
  }, [imagePath]);

  return (
    <View style={styles.container}>
      {processedImageBase64 ? (
        <Image
          source={{ uri: processedImageBase64 }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 500,
    height: 400,
  },
});
