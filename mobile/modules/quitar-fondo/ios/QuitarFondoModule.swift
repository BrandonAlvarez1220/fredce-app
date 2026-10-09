import CoreImage
import CoreImage.CIFilterBuiltins
import ExpoModulesCore
import UIKit
import Vision

// Si el sujeto ocupa menos de esto de la foto, se descarta (mismo criterio
// que en Android): casi seguro el modelo agarró algo chico del fondo.
private let areaMinimaSujeto: CGFloat = 0.02
private let calidadJpeg: CGFloat = 0.75

public class QuitarFondoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QuitarFondo")

    // VNGenerateForegroundInstanceMaskRequest existe a partir de iOS 17;
    // en versiones anteriores el interruptor se oculta desde JS.
    Function("estaDisponible") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    // Recibe el file:// de una foto, devuelve el file:// de una foto nueva
    // con el fondo en blanco (JPEG), o nil si no detectó un sujeto claro.
    AsyncFunction("quitarFondoAsync") { (uri: String) throws -> String? in
      guard #available(iOS 17.0, *) else {
        return nil
      }
      guard let url = URL(string: uri), let imagen = UIImage(contentsOfFile: url.path) else {
        throw Exception(name: "ERR_QUITAR_FONDO", description: "No se pudo leer la imagen: \(uri)")
      }
      // Normaliza la orientación (EXIF) dibujando la imagen: así la máscara
      // y los píxeles quedan en el mismo sistema de coordenadas.
      let formato = UIGraphicsImageRendererFormat()
      formato.scale = 1
      let normalizada = UIGraphicsImageRenderer(size: imagen.size, format: formato).image { _ in
        imagen.draw(at: .zero)
      }
      guard let cg = normalizada.cgImage else {
        throw Exception(name: "ERR_QUITAR_FONDO", description: "Imagen sin CGImage")
      }

      let handler = VNImageRequestHandler(cgImage: cg, options: [:])
      let request = VNGenerateForegroundInstanceMaskRequest()
      try handler.perform([request])
      guard let resultado = request.results?.first, !resultado.allInstances.isEmpty else {
        return nil
      }
      let mascara = try resultado.generateScaledMaskForImage(forInstances: resultado.allInstances, from: handler)

      let original = CIImage(cgImage: cg)
      let mascaraCI = CIImage(cvPixelBuffer: mascara)

      // Descarta sujetos diminutos: promedio de la máscara = fracción de área.
      let promedio = CIFilter.areaAverage()
      promedio.inputImage = mascaraCI
      promedio.extent = mascaraCI.extent
      let contexto = CIContext()
      if let salidaPromedio = promedio.outputImage {
        var pixel = [Float](repeating: 0, count: 4)
        contexto.render(
          salidaPromedio, toBitmap: &pixel, rowBytes: 16,
          bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBAf, colorSpace: nil)
        if CGFloat(pixel[0]) < areaMinimaSujeto {
          return nil
        }
      }

      // Mezcla con la máscara suave: sujeto original sobre fondo blanco.
      let blanco = CIImage(color: .white).cropped(to: original.extent)
      let mezcla = CIFilter.blendWithMask()
      mezcla.inputImage = original
      mezcla.backgroundImage = blanco
      mezcla.maskImage = mascaraCI
      guard let salida = mezcla.outputImage,
            let cgSalida = contexto.createCGImage(salida, from: original.extent),
            let datos = UIImage(cgImage: cgSalida).jpegData(compressionQuality: calidadJpeg) else {
        throw Exception(name: "ERR_QUITAR_FONDO", description: "No se pudo generar la imagen sin fondo")
      }

      let destino = FileManager.default.temporaryDirectory
        .appendingPathComponent("sinfondo_\(UUID().uuidString).jpg")
      try datos.write(to: destino)
      return destino.absoluteString
    }
  }
}
