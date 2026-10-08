import { serializeJsonLd, type JsonLdObject } from "@/lib/seo";

// Server-component-friendly <script type="application/ld+json">. The payload
// is built from our own content (never user input at request time), and
// serializeJsonLd() escapes "<" so no string value can close the tag early.
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
