import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";
import { XMLParser } from "fast-xml-parser";

export type ParsedChapter = {
  title: string;
  order: number;
  content: string;
};

export type ParsedBook = {
  title: string;
  author: string;
  chapters: ParsedChapter[];
};

export async function parseEpub(url: string): Promise<ParsedBook> {
  console.log("1. fetching file...");
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const tempPath = path.join(os.tmpdir(), `epub-${Date.now()}.epub`);
  fs.writeFileSync(tempPath, Buffer.from(buffer));
  console.log("2. file written to temp:", tempPath);

  const zip = new AdmZip(tempPath);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  // 1. Find the OPF file path from META-INF/container.xml
  const containerXml = zip.getEntry("META-INF/container.xml");
  if (!containerXml) throw new Error("No container.xml found");
  const container = parser.parse(containerXml.getData().toString("utf8"));
  const opfPath: string =
    container?.container?.rootfiles?.rootfile?.["@_full-path"] ?? "OEBPS/content.opf";
  const opfDir = path.dirname(opfPath);
  console.log("3. opf path:", opfPath);

  // 2. Parse the OPF file for metadata and spine
  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) throw new Error("No OPF file found");
  const opf = parser.parse(opfEntry.getData().toString("utf8"));

  const metadata = opf?.package?.metadata;
  const title = metadata?.["dc:title"] ?? "Unknown Title";
  const author =
    metadata?.["dc:creator"]?.["#text"] ??
    metadata?.["dc:creator"] ??
    "Unknown Author";
  console.log("4. title:", title, "author:", author);

  // 3. Build id -> href map from manifest
  const manifestItems = opf?.package?.manifest?.item ?? [];
  const items = Array.isArray(manifestItems) ? manifestItems : [manifestItems];
  const idToHref: Record<string, string> = {};
  for (const item of items) {
    if (item["@_id"] && item["@_href"]) {
      idToHref[item["@_id"]] = item["@_href"];
    }
  }

  // 4. Require toc.ncx — throw if missing
  const tocId = items.find(
    (i: Record<string, string>) =>
      i["@_media-type"] === "application/x-dtbncx+xml"
  )?.["@_href"];

  if (!tocId) {
    fs.unlinkSync(tempPath);
    throw new Error(
      "This EPUB does not contain a toc.ncx file. Please upload an EPUB2-compatible file."
    );
  }

  const tocPath = opfDir === "." ? tocId : `${opfDir}/${tocId}`;
  const tocEntry = zip.getEntry(tocPath) ?? zip.getEntry(tocId);

  if (!tocEntry) {
    fs.unlinkSync(tempPath);
    throw new Error(
      "toc.ncx referenced in manifest but not found in EPUB. The file may be corrupt."
    );
  }

  const toc = parser.parse(tocEntry.getData().toString("utf8"));
  const navPoints = toc?.ncx?.navMap?.navPoint ?? [];
  const points = Array.isArray(navPoints) ? navPoints : [navPoints];

  const idToTitle: Record<string, string> = {};
  for (const point of points) {
    const label = point?.navLabel?.text?.toString()?.trim();
    const contentSrc: string = point?.content?.["@_src"] ?? "";
    const cleanSrc = contentSrc.split("#")[0];
    if (label && cleanSrc) {
      idToTitle[cleanSrc] = label;
    }
  }
  console.log("4b. toc titles found:", Object.keys(idToTitle).length);

  // 5. Get spine order
  const spineItems = opf?.package?.spine?.itemref ?? [];
  const spine = Array.isArray(spineItems) ? spineItems : [spineItems];
  console.log("5. spine items:", spine.length);

  // 6. Extract chapter text in spine order
  const chapters: ParsedChapter[] = [];
  let order = 0;

  for (const ref of spine) {
    const idref = ref["@_idref"];
    const href = idToHref[idref];
    if (!href) continue;

    const fullPath =
      opfDir === "." ? href : `${opfDir}/${href}`.replace(/\/\.\//g, "/");
    const entry = zip.getEntry(fullPath) ?? zip.getEntry(href);
    if (!entry) continue;

    const html = entry.getData().toString("utf8");
    const clean = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length < 100) continue;

    const tocTitle =
      idToTitle[href] ?? idToTitle[href.split("/").pop() ?? ""];
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const chapterTitle =
      tocTitle ?? titleMatch?.[1]?.trim() ?? `Chapter ${order + 1}`;



      const skipPatterns = [
        /^contents$/i,
        /^table of contents$/i,
        /^license$/i,
        /gutenberg/i,
        /^cover$/i,
        /^copyright$/i,
        /^dedication$/i,
        /^index$/i,
        /^or,/i,
        /^preface$/i,
        /^[A-Z\s]+$/, 
      ];
      // Skip if chapter title contains the book title (author name leaked in)
      const titleWords = title.toLowerCase().split(" ").filter((w: string) => w.length > 3);
      const chapterLower = chapterTitle.toLowerCase();
      const looksLikeBookTitle = titleWords.filter((w: string) => chapterLower.includes(w)).length >= 2;
      if (looksLikeBookTitle) {
        continue;
      }
      
      const shouldSkip = skipPatterns.some((pattern) => pattern.test(chapterTitle));
      if (shouldSkip) continue;  
    chapters.push({
      title: chapterTitle,
      order: order++,
      content: clean.slice(0, 8000),
    });

    console.log("6. parsed chapter:", chapterTitle);
  }

  fs.unlinkSync(tempPath);
  console.log("7. done. total chapters:", chapters.length);

  return { title, author, chapters };
}