package expo.modules.quitarfondo

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.Executors

// Debajo de esto se considera que el modelo no encontró ningún "sujeto"
// (p. ej. una foto de una pared): en vez de devolver una imagen casi toda
// blanca, se avisa a JS con null para que guarde la foto original.
private const val UMBRAL_SUJETO = 0.5f

// Si el sujeto ocupa menos de esto de la foto, igual se descarta: casi
// seguro el modelo agarró algo chico del fondo y no la válvula.
private const val AREA_MINIMA_SUJETO = 0.02f

private const val CALIDAD_JPEG = 75

class QuitarFondoModule : Module() {
  // Los listeners de ML Kit corren por defecto en el hilo principal; el
  // recorrido de ~2M píxeles se manda a este hilo para no congelar la UI.
  private val ejecutor = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("QuitarFondo")

    Function("estaDisponible") { true }

    // Recibe el file:// de una foto, devuelve el file:// de una foto nueva
    // con el fondo en blanco (JPEG), o null si no detectó un sujeto claro.
    AsyncFunction("quitarFondoAsync") { uri: String, promise: Promise ->
      val ruta = Uri.parse(uri).path
      val original = ruta?.let {
        BitmapFactory.decodeFile(it, BitmapFactory.Options().apply {
          inPreferredConfig = Bitmap.Config.ARGB_8888
        })
      }
      if (original == null) {
        promise.reject("ERR_QUITAR_FONDO", "No se pudo leer la imagen: $uri", null)
        return@AsyncFunction
      }

      // Se pide solo la máscara de confianza (un float 0..1 por píxel) y
      // no el bitmap recortado: así podemos mezclar contra blanco con
      // bordes suaves en lugar de un corte duro.
      val opciones = SubjectSegmenterOptions.Builder()
        .enableForegroundConfidenceMask()
        .build()
      val segmentador = SubjectSegmentation.getClient(opciones)

      segmentador.process(InputImage.fromBitmap(original, 0))
        .addOnSuccessListener(ejecutor) { resultado ->
          try {
            val mascara = resultado.foregroundConfidenceMask
            if (mascara == null) {
              promise.resolve(null)
              return@addOnSuccessListener
            }
            val ancho = original.width
            val alto = original.height
            val pixeles = IntArray(ancho * alto)
            original.getPixels(pixeles, 0, ancho, 0, 0, ancho, alto)

            mascara.rewind()
            var pixelesSujeto = 0
            for (i in pixeles.indices) {
              val a = mascara.get().coerceIn(0f, 1f)
              if (a >= UMBRAL_SUJETO) pixelesSujeto++
              val p = pixeles[i]
              // Mezcla lineal: a=1 deja el píxel original, a=0 lo vuelve blanco.
              val r = (Color.red(p) * a + 255 * (1 - a)).toInt()
              val g = (Color.green(p) * a + 255 * (1 - a)).toInt()
              val b = (Color.blue(p) * a + 255 * (1 - a)).toInt()
              pixeles[i] = Color.rgb(r, g, b)
            }

            if (pixelesSujeto < pixeles.size * AREA_MINIMA_SUJETO) {
              promise.resolve(null)
              return@addOnSuccessListener
            }

            val salida = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888)
            salida.setPixels(pixeles, 0, ancho, 0, 0, ancho, alto)
            val archivo = File(appContext.cacheDirectory, "sinfondo_${UUID.randomUUID()}.jpg")
            FileOutputStream(archivo).use { salida.compress(Bitmap.CompressFormat.JPEG, CALIDAD_JPEG, it) }
            salida.recycle()
            promise.resolve(Uri.fromFile(archivo).toString())
          } catch (e: Throwable) {
            promise.reject("ERR_QUITAR_FONDO", e.message ?: "Error al procesar la máscara", e)
          } finally {
            original.recycle()
            segmentador.close()
          }
        }
        .addOnFailureListener(ejecutor) { e ->
          // Caso típico: el modelo aún no se descarga (primer uso sin señal).
          original.recycle()
          segmentador.close()
          promise.reject("ERR_QUITAR_FONDO", e.message ?: "ML Kit no pudo segmentar la imagen", e)
        }
    }
  }
}
