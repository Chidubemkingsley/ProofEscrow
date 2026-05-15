/**
 * Pinata IPFS helper — pins evidence files and returns a public gateway URL.
 */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT ?? "";

/**
 * Upload a file to IPFS via Pinata.
 * Returns the public IPFS gateway URL.
 */
export async function pinFileToIPFS(file: File): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error("VITE_PINATA_JWT is not set. Add it to your .env file.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: `settla-evidence-${Date.now()}` })
  );
  formData.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1 })
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}
