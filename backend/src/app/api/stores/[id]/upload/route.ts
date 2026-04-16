import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/stores/:id/upload
 *
 * Uploads a file to Shopify via staged uploads.
 *
 * Accepts multipart form with a 'file' field.
 * Validates: max 2MB, allowed types (png, svg, jpeg, webp).
 * Returns { url: resourceUrl }.
 */

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/svg+xml',
  'image/jpeg',
  'image/webp',
]);

async function shopifyGraphQL(shopDomain: string, token: string, query: string, variables?: any) {
  const res = await fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL ${res.status}: ${text}`);
  }
  return res.json();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: { shopDomain: true, accessToken: true },
    });

    if (!store?.accessToken) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    // Validate file type
    const mimeType = file.type;
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `File type '${mimeType}' not allowed. Allowed: png, svg, jpeg, webp` },
        { status: 400 },
      );
    }

    const fileName = (file as any).name || `upload.${mimeType.split('/')[1] || 'png'}`;
    const shopDomain = store.shopDomain;
    const token = store.accessToken;

    // 1. Create staged upload
    const stagedResult = await shopifyGraphQL(shopDomain, token, `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }
    `, {
      input: [{
        filename: fileName,
        mimeType,
        resource: 'IMAGE',
        httpMethod: 'POST',
      }],
    });

    const stagedErrors = stagedResult?.data?.stagedUploadsCreate?.userErrors;
    if (stagedErrors?.length > 0) {
      return NextResponse.json({ error: 'Staged upload failed', details: stagedErrors }, { status: 500 });
    }

    const target = stagedResult?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      return NextResponse.json({ error: 'No staged target returned' }, { status: 500 });
    }

    // 2. Upload file to staged URL
    const uploadForm = new FormData();
    for (const param of target.parameters) {
      uploadForm.append(param.name, param.value);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    uploadForm.append('file', new Blob([buffer], { type: mimeType }), fileName);

    const uploadRes = await fetch(target.url, { method: 'POST', body: uploadForm });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return NextResponse.json({ error: `Upload failed: ${uploadRes.status}`, details: text }, { status: 500 });
    }

    return NextResponse.json({ url: target.resourceUrl });
  } catch (err: any) {
    console.error('[upload] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
