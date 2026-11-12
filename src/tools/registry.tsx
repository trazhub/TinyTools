import type { ComponentType } from "react";
import WordCounter from "@/os/apps/utilities/word-counter";
import JsonFormatter from "@/os/apps/utilities/json-formatter";
import Base64 from "@/os/apps/utilities/base64-encoder-decoder";
import PasswordGenerator from "@/os/apps/utilities/password-generator";
import ImageCompressor from "@/os/apps/utilities/image-compressor";
import ImageResize from "./image-resize";
import ImageConverter from "./image-converter";
import ImageCrop from "./image-crop";
import ImageRotate from "./image-rotate";
import ImageMetadata from "./image-metadata";
import ImageColors from "./image-colors";
import HeicConverter from "./heic-converter";
import PdfMaker from "./pdf-maker";
import PdfToImages from "./pdf-to-images";
import PdfDark from "./pdf-dark";
import PdfCompress from "./pdf-compress";
import PdfEdit from "./pdf-edit";
import PdfMerge from "./pdf-merge";
import PdfSplit from "./pdf-split";
import PdfOrganize from "./pdf-organize";
import PdfPlace from "./pdf-place";
import PdfRedact from "./pdf-redact";
import PdfForms from "./pdf-forms";
import PdfCompare from "./pdf-compare";
import ServerPdf from "./server-pdf";
import Ocr from "./ocr";
import VideoConverter from "./video-converter";
import MediaTool from "./media-tools";
import VideoFrames from "./video-frames";
import Viewer3D from "./viewer-3d";
import QrCode from "./qr-code";
import CaseConverter from "./text/case-converter";
import TextDiff from "./text/text-diff";
import HashGenerator from "./text/hash-generator";
import UuidGenerator from "./text/uuid-generator";
import JwtDecoder from "./text/jwt-decoder";
import UrlEncoder from "./text/url-encoder";
import TimestampConverter from "./text/timestamp-converter";
import ColorConverter from "./text/color-converter";
import RegexTester from "./text/regex-tester";
import UnitConverter from "./text/unit-converter";
import LoremIpsum from "./text/lorem-ipsum";
import MarkdownPreview from "./text/markdown-preview";
import PercentageCalculator from "./text/percentage-calculator";
import DateCalculator from "./text/date-calculator";
import StopwatchTimer from "./text/stopwatch-timer";

/** Which component shows on which tool page. The names, groups and descriptions live in src/lib/tool-list.ts. */
export const VIEWS: Record<string, ComponentType> = {
  // PDF
  "merge-pdf": PdfMerge,
  "split-pdf": PdfSplit,
  "remove-pages": () => <PdfEdit kind="remove-pages" />,
  "extract-pages": () => <PdfEdit kind="extract-pages" />,
  "organize-pdf": PdfOrganize,
  "rotate-pdf": () => <PdfEdit kind="rotate-pdf" />,
  "page-numbers": () => <PdfEdit kind="page-numbers" />,
  "watermark-pdf": () => <PdfEdit kind="watermark-pdf" />,
  "crop-pdf": () => <PdfEdit kind="crop-pdf" />,
  "sign-pdf": () => <PdfPlace mode="sign" />,
  "edit-pdf": () => <PdfPlace mode="edit" />,
  "fill-pdf-form": PdfForms,
  "redact-pdf": PdfRedact,
  "compare-pdf": PdfCompare,
  "pdf-maker": PdfMaker,
  "scan-to-pdf": () => <PdfMaker scan />,
  "pdf-to-images": PdfToImages,
  "pdf-dark-mode": PdfDark,
  "pdf-compress": PdfCompress,
  "unlock-pdf": () => <ServerPdf kind="unlock-pdf" />,
  "protect-pdf": () => <ServerPdf kind="protect-pdf" />,
  "repair-pdf": () => <ServerPdf kind="repair-pdf" />,
  "ocr-pdf": () => <ServerPdf kind="ocr-pdf" />,
  ocr: Ocr,
  // Images
  "image-scaler": () => <ImageResize mode="scale" />,
  "resolution-changer": () => <ImageResize mode="resolution" />,
  "image-format-changer": ImageConverter,
  "crop-image": ImageCrop,
  "rotate-image": ImageRotate,
  "heic-to-jpg": HeicConverter,
  "remove-metadata": ImageMetadata,
  "image-colors": ImageColors,
  "image-compressor": ImageCompressor,
  // Video, audio and 3D
  "video-format-changer": VideoConverter,
  "video-thumbnail": VideoFrames,
  "extract-audio": () => <MediaTool kind="audio-extract" />,
  "video-to-gif": () => <MediaTool kind="video-gif" />,
  "video-compressor": () => <MediaTool kind="video-compress" />,
  "video-trim": () => <MediaTool kind="video-trim" />,
  "audio-converter": () => <MediaTool kind="audio-convert" />,
  "3d-viewer": Viewer3D,
  // Text
  "word-counter": WordCounter,
  "case-converter": CaseConverter,
  "text-diff": TextDiff,
  "lorem-ipsum": LoremIpsum,
  "markdown-preview": MarkdownPreview,
  // Developer
  "json-formatter": JsonFormatter,
  base64: Base64,
  "url-encoder": UrlEncoder,
  "hash-generator": HashGenerator,
  "uuid-generator": UuidGenerator,
  "jwt-decoder": JwtDecoder,
  "regex-tester": RegexTester,
  "timestamp-converter": TimestampConverter,
  "color-converter": ColorConverter,
  "qr-code": QrCode,
  "password-generator": PasswordGenerator,
  // Everyday
  "unit-converter": UnitConverter,
  "percentage-calculator": PercentageCalculator,
  "date-calculator": DateCalculator,
  "stopwatch-timer": StopwatchTimer,
};
