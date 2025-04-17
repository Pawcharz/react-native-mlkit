package com.mlkittest.objectDetector

import com.google.mlkit.vision.objects.custom.CustomObjectDetectorOptions
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.common.model.LocalModel

class ObjectDetectorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val objectDetector: ObjectDetector

    init {
        val localModel = LocalModel.Builder()
            .setAssetFilePath("model.tflite")
            .build()

        val options = CustomObjectDetectorOptions.Builder(localModel)
            .setDetectorMode(CustomObjectDetectorOptions.SINGLE_IMAGE_MODE)
            .enableMultipleObjects()
            .enableClassification()
            .build()

        objectDetector = ObjectDetection.getClient(options)
    }

    @ReactMethod
    fun detectObject(base64Image: String, promise: Promise) {
        val bitmap = decodeBase64ToBitmap(base64Image)
        val inputImage = InputImage.fromBitmap(bitmap, 0)

        objectDetector.process(inputImage)
            .addOnSuccessListener { objects ->
                val result = WritableNativeArray()
                for (obj in objects) {
                    val map = WritableNativeMap()
                    map.putInt("id", obj.trackingId ?: -1)
                    map.putArray("labels", WritableNativeArray().apply {
                        obj.labels.forEach { addString(it.text) }
                    })
                    result.pushMap(map)
                }
                promise.resolve(result)
            }
            .addOnFailureListener { e ->
                promise.reject("DetectionError", e)
            }
    }

    private fun decodeBase64ToBitmap(base64Str: String): Bitmap {
        val decodedBytes = Base64.decode(base64Str, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
    }

    override fun getName(): String = "ObjectDetectorModule"
}
