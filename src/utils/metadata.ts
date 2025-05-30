class Metadata {
    discriminator: number; // u8 is typically represented as number in TS
    name: string;
    symbol: string;
    uri: string;

    constructor(discriminator: number, name: string, symbol: string, uri: string) {
        this.discriminator = discriminator;
        this.name = name;
        this.symbol = symbol;
        this.uri = uri;
    }
}

// Function to read a string prefixed by its length (4-byte integer)
function readLengthPrefixedString(data: Uint8Array, offset: number): [string, number] {
    // Read the string length from the first 4 bytes
    const length = (data[offset]) | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
    offset += 4; // Move past the length

    // Read the string of specified length
    const stringBytes = data.subarray(offset, offset + length);
    const stringValue = new TextDecoder("utf-8").decode(stringBytes);

    return [stringValue, offset + length]; // Move past the string
}

// Function to parse the Uint8Array to Metadata
export function parseMetadata(data: Uint8Array): Metadata {
    const discriminator = data[0]; // Read the first byte for the discriminator
    let offset = 1; // Start reading after the discriminator

    const [name, afterName] = readLengthPrefixedString(data, offset);
    offset = afterName;

    const [symbol, afterSymbol] = readLengthPrefixedString(data, offset);
    offset = afterSymbol;

    const [uri, afterUri] = readLengthPrefixedString(data, offset);
    offset = afterUri;

    return new Metadata(discriminator, name, symbol, uri);
}
