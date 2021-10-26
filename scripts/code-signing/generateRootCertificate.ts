import fs from 'fs/promises';
import { pki as PKI, util, random, md } from 'node-forge';

// a hexString is considered negative if it's most significant bit is 1
// because serial numbers use ones' complement notation
// this RFC in section 4.1.2.2 requires serial numbers to be positive
// http://www.ietf.org/rfc/rfc5280.txt
function toPositiveHex(hexString: string) {
  let mostSiginficativeHexAsInt = parseInt(hexString[0], 16);
  if (mostSiginficativeHexAsInt < 8) {
    return hexString;
  }
  mostSiginficativeHexAsInt -= 8;
  return mostSiginficativeHexAsInt.toString() + hexString.substring(1);
}

export async function run() {
  const rsa = PKI.rsa;

  const { privateKey, publicKey } = rsa.generateKeyPair();
  const cert = PKI.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = toPositiveHex(util.bytesToHex(random.getBytesSync(9)));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    {
      name: 'commonName',
      value: 'example.org',
    },
    {
      name: 'countryName',
      value: 'US',
    },
    {
      shortName: 'ST',
      value: 'Virginia',
    },
    {
      name: 'localityName',
      value: 'Blacksburg',
    },
    {
      name: 'organizationName',
      value: 'Test',
    },
    {
      shortName: 'OU',
      value: 'Test',
    },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: 'keyUsage',
      critical: true,
      keyCertSign: false,
      digitalSignature: true,
      nonRepudiation: false,
      keyEncipherment: false,
      dataEncipherment: false,
    },
    {
      name: 'extKeyUsage',
      critical: true,
      serverAuth: false,
      clientAuth: false,
      codeSigning: true,
      emailProtection: false,
      timeStamping: false,
    },
  ]);
  cert.sign(privateKey, md.sha256.create());

  console.log({
    publicKey: PKI.publicKeyToPem(publicKey),
    privateKey: PKI.privateKeyToPem(privateKey),
    certificate: PKI.certificateToPem(cert),
  });

  await Promise.all([
    fs.writeFile('keys/public-key.pem', PKI.publicKeyToPem(publicKey)),
    fs.writeFile('keys/private-key.pem', PKI.privateKeyToPem(privateKey)),
    fs.writeFile('keys/certificate.pem', PKI.certificateToPem(cert)),
  ]);
}
