"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { baseName, errorMessage } from "./shared";
import { ResultCard } from "./result-card";
import { loadPdfLib, pdfBlob } from "./pdf-utils";

type Field =
  | { name: string; type: "text"; value: string }
  | { name: string; type: "check"; value: boolean }
  | { name: string; type: "choice"; options: string[]; value: string };

/** Fill in a PDF's form fields (text boxes, tick boxes, drop-downs, radio buttons). */
export default function PdfForms() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Field[] | null>(null);
  const [flatten, setFlatten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  async function pick([f]: File[]) {
    setResult(null);
    if (!f) return;
    setError(null);
    setFields(null);
    try {
      const { PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList } = await import("pdf-lib");
      const form = (await loadPdfLib(f)).getForm();
      const list: Field[] = [];
      for (const fld of form.getFields()) {
        const name = fld.getName();
        if (fld instanceof PDFTextField) list.push({ name, type: "text", value: fld.getText() ?? "" });
        else if (fld instanceof PDFCheckBox) list.push({ name, type: "check", value: fld.isChecked() });
        else if (fld instanceof PDFDropdown) list.push({ name, type: "choice", options: fld.getOptions(), value: fld.getSelected()[0] ?? "" });
        else if (fld instanceof PDFRadioGroup) list.push({ name, type: "choice", options: fld.getOptions(), value: fld.getSelected() ?? "" });
        else if (fld instanceof PDFOptionList) list.push({ name, type: "choice", options: fld.getOptions(), value: fld.getSelected()[0] ?? "" });
      }
      setFile(f);
      setFields(list);
    } catch (e) {
      setFile(null);
      setError(errorMessage(e));
    }
  }

  async function save() {
    if (!file || !fields) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList } = await import("pdf-lib");
      const doc = await loadPdfLib(file);
      const form = doc.getForm();
      for (const f of fields) {
        const fld = form.getField(f.name);
        if (f.type === "text" && fld instanceof PDFTextField) fld.setText(f.value);
        else if (f.type === "check" && fld instanceof PDFCheckBox) { if (f.value) fld.check(); else fld.uncheck(); }
        else if (f.type === "choice" && f.value) {
          if (fld instanceof PDFDropdown || fld instanceof PDFRadioGroup || fld instanceof PDFOptionList) fld.select(f.value);
        }
      }
      if (flatten) form.flatten();
      setResult({ blob: await pdfBlob(doc), name: `${baseName(file.name)}-filled.pdf` });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, patch: Partial<Field>) => setFields((l) => l && l.map((f, j) => (j === i ? ({ ...f, ...patch } as Field) : f)));

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf,.pdf" hint="A PDF with form fields. Nothing is uploaded." onFiles={pick} />
      {fields && fields.length === 0 && <Alert tone="info">This PDF has no fillable fields. Try Edit PDF to type onto it instead.</Alert>}
      {fields && fields.length > 0 && (
        <div className="space-y-5">
          {fields.map((f, i) => (
            <div key={f.name}>
              {f.type === "text" && (
                <ToolField label={f.name} htmlFor={`f-${i}`}>
                  <Input id={`f-${i}`} value={f.value} onChange={(e) => set(i, { value: e.target.value })} />
                </ToolField>
              )}
              {f.type === "check" && <Checkbox label={f.name} checked={f.value} onCheckedChange={(v) => set(i, { value: v })} />}
              {f.type === "choice" && (
                <ToolField label={f.name} htmlFor={`f-${i}`}>
                  <Select id={`f-${i}`} value={f.value} onChange={(e) => set(i, { value: e.target.value })}>
                    <option value="">(none)</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </ToolField>
              )}
            </div>
          ))}
          <Checkbox label="Make the fields permanent" hint="Turns the answers into normal page content so they can't be changed." checked={flatten} onCheckedChange={setFlatten} />
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Saving…" : "Save PDF"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <ResultCard blob={result.blob} name={result.name} />}
    </div>
  );
}
