package com.example.backend.product;

import com.example.backend.api.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ImageStorageService {
    private static final Set<Integer> WIDTHS = Set.of(480, 1200);
    private final Path images;
    private final Path variants;

    public ImageStorageService(@Value("${filmplace.images-path:images}") String imagesPath) throws IOException {
        this.images = Path.of(imagesPath).toAbsolutePath().normalize();
        this.variants = images.resolve("variants");
        Files.createDirectories(variants);
    }

    public String store(MultipartFile file) {
        if (file.isEmpty() || file.getContentType() == null || !file.getContentType().startsWith("image/")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only image files can be uploaded");
        }
        String extension = extension(file.getOriginalFilename());
        String filename = UUID.randomUUID() + extension;
        Path destination = safeSource(filename);
        try {
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
            BufferedImage source = ImageIO.read(destination.toFile());
            if (source == null) throw new IOException("Unsupported image format");
            for (int width : WIDTHS) createVariant(source, stem(filename), width);
            return "/images/" + filename;
        } catch (IOException exception) {
            delete("/images/" + filename);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image could not be processed");
        }
    }

    public Path resolve(String filename, Integer width) {
        String safeName = safeFilename(filename);
        if (width == null) return safeSource(safeName);
        if (!WIDTHS.contains(width)) throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported image width");
        Path webp = variants.resolve(stem(safeName) + "-" + width + ".webp");
        if (Files.exists(webp)) return webp;
        Path jpeg = variants.resolve(stem(safeName) + "-" + width + ".jpg");
        if (Files.exists(jpeg)) return jpeg;
        try {
            BufferedImage source = ImageIO.read(safeSource(safeName).toFile());
            if (source == null) throw new IOException("Unsupported image format");
            createVariant(source, stem(safeName), width);
            return jpeg;
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Image not found");
        }
    }

    public void delete(String imageUrl) {
        String filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        try {
            Files.deleteIfExists(safeSource(filename));
            try (DirectoryStream<Path> files = Files.newDirectoryStream(variants, stem(filename) + "-*")) {
                for (Path file : files) Files.deleteIfExists(file);
            }
        } catch (IOException ignored) {
            // The database operation should still succeed if a file is already absent.
        }
    }

    private void createVariant(BufferedImage source, String stem, int targetWidth) throws IOException {
        int width = Math.min(targetWidth, source.getWidth());
        int height = Math.max(1, (int) Math.round(source.getHeight() * (width / (double) source.getWidth())));
        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = resized.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.drawImage(source, 0, 0, width, height, null);
        graphics.dispose();
        ImageIO.write(resized, "jpg", variants.resolve(stem + "-" + targetWidth + ".jpg").toFile());
    }

    private Path safeSource(String filename) {
        Path path = images.resolve(safeFilename(filename)).normalize();
        if (!path.getParent().equals(images)) throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid image filename");
        return path;
    }

    private String safeFilename(String filename) {
        if (filename == null || filename.isBlank() || !Path.of(filename).getFileName().toString().equals(filename)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid image filename");
        }
        return filename;
    }

    private String extension(String originalName) {
        if (originalName == null) return ".jpg";
        int dot = originalName.lastIndexOf('.');
        String extension = dot < 0 ? ".jpg" : originalName.substring(dot).toLowerCase(Locale.ROOT);
        return Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp").contains(extension) ? extension : ".jpg";
    }

    private String stem(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? filename : filename.substring(0, dot);
    }
}
