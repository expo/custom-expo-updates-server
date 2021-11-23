/**
 * This file is a partial implementation of https://tools.ietf.org/html/draft-ietf-httpbis-header-structure-19
 */

/**
 * @remark This only supports integer-, decimal-, boolean- and string- values as that is more
 * than enough for our usage.
 *
 * @link https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-header-structure-19#section-3.3
 */
type StructuredFieldBareItem = number | string | boolean;

export type StructuredFieldItem = {
  value: StructuredFieldBareItem;
  parameters?: StructuredFieldParameters;
};

type StructuredFieldParameters = {
  [key: string]: StructuredFieldBareItem;
};

export type StructuredFieldDictionary = {
  [key: string]: StructuredFieldItem;
};

// This is a convenience type, it is not in the spec
export type StructuredFieldBareItemRecord = {
  [key: string]: StructuredFieldBareItem;
};

/**
 * @link https://httpwg.org/http-extensions/draft-ietf-httpbis-header-structure.html#name-serializing-an-item
 */
export function serializeBareItem(item: StructuredFieldBareItem): string {
  switch (typeof item) {
    case 'number':
      if (Number.isInteger(item)) {
        return serializeInteger(item);
      }
      return serializeDecimal(item);
    case 'string':
      return serializeString(item);
    case 'boolean':
      return serializeBoolean(item);
    default:
      throw new Error(
        `Failed to serialize ${item}. Values must be either an integer, decimal, or a string`
      );
  }
}

/**
 * @link https://httpwg.org/http-extensions/draft-ietf-httpbis-header-structure.html#name-serializing-an-integer
 */
export function serializeInteger(value: number): string {
  if (Math.abs(value) > 999_999_999_999_999) {
    throw new Error(
      `Failed to serialize ${value}. Integers must have absolute value strictly less than 1,000,000,000,000,000.`
    );
  }
  return value.toString();
}

/**
 *
 * @link https://httpwg.org/http-extensions/draft-ietf-httpbis-header-structure.html#name-serializing-a-decimal
 */
export function serializeDecimal(value: number): string {
  const roundedValue = roundToEven(value, 3); // round to 3 decimal places
  if (Math.floor(Math.abs(roundedValue)) > 999_999_999_999) {
    throw new Error(
      `Failed to serialize ${value}. Decimal's integer part must have 12 or fewer characters.`
    );
  }
  const stringValue = roundedValue.toString();
  return stringValue.includes('.') ? stringValue : `${stringValue}.0`;
}

/**
 * This implements the rounding procedure described in step 2 of the "Serializing a Decimal" specification.
 * This rounding style is known as "even rounding", "banker's rounding", or "commercial rounding".
 */
function roundToEven(value: number, precision: number): number {
  if (value < 0) {
    return -roundToEven(-value, precision);
  }

  const decimalShift = Math.pow(10, precision);
  const isEquidistant = Math.abs(((value * decimalShift) % 1) - 0.5) < Number.EPSILON;
  if (isEquidistant) {
    // If the tail of the decimal place is 'equidistant' we round to the nearest even value
    const flooredValue = Math.floor(value * decimalShift);
    return (flooredValue % 2 === 0 ? flooredValue : flooredValue + 1) / decimalShift;
  } else {
    // Otherwise, proceed as normal
    return Math.round(value * decimalShift) / decimalShift;
  }
}

/**
 * @link https://httpwg.org/http-extensions/draft-ietf-httpbis-header-structure.html#name-serializing-a-string
 */
export function serializeString(value: string): string {
  if (!/^[\x00-\x7F]*$/.test(value)) {
    throw new Error(`Failed to serialize, ${value}. Strings must be ASCII.`);
  }
  if (/[\x00-\x1f\x7f]+/.test(value)) {
    throw new Error('Strings must not contain characters in the range %x00-1f or %x7f');
  }
  return `"${value.replace(/\\/g, `\\\\`).replace(/"/g, `\\"`)}"`;
}

/**
 * @link https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-header-structure-19#section-3.3.6
 */
export function serializeBoolean(item: boolean): string {
  if (item === false) {
    return '?0';
  } else if (item === true) {
    return '?1';
  }
  throw new Error(`Failed to serialize ${item}. Expected a boolean value.`);
}

/**
 * @link https://httpwg.org/http-extensions/draft-ietf-httpbis-header-structure.html#ser-key
 */
export function serializeKey(key: string): string {
  if (!/^[\x00-\x7F]+$/.test(key)) {
    throw new Error(`Failed to serialize, ${key}. Keys must be ASCII.`);
  }
  if (!/^[a-z0-9\-_.*]*$/.test(key)) {
    throw new Error(
      `Failed to serialize ${key}. Keys may only contain characters in lower case alphabet, DIGIT, "_", "-",".", or "*".`
    );
  }
  if (!/^[a-z*]/.test(key)) {
    throw new Error(
      `Failed to serialize ${key}. The first character of a key must lower case alphabet or "*"`
    );
  }
  return key;
}

/**
 * The 'true' value is indicated by omitting the value in a Dictionary or Parameter
 *
 * @link https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-header-structure-19#section-3.3.6
 */
function serializeTrueByOmission(): string {
  return '';
}

/**
 * Convert an object into a `Structured Field` header according to the spec for dictionaries
 *
 * @link https://httpwg.org/http-extensions/draft-ietf-httpbis-header-structure.html#ser-dictionary
 */
export function serializeDictionary(dict: StructuredFieldDictionary): string {
  return Object.entries(dict)
    .map(([key, structuredFieldItem]) => {
      const { value, parameters } = structuredFieldItem;
      let output = serializeKey(key);
      if (value === true) {
        output += serializeTrueByOmission();
      } else {
        output += '=';
        output += serializeBareItem(value);
      }
      if (parameters) {
        output += serializeParameters(parameters);
      }
      return output;
    })
    .join(', ');
}

/**
 * Convert an object into a `Structured Field` header according to the spec for parameters
 *
 * @link https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-header-structure-19#section-4.1.1.2
 */
export function serializeParameters(parameters: StructuredFieldParameters): string {
  return Object.entries(parameters)
    .map(([key, value]) => {
      let output = ';';
      output += serializeKey(key);
      if (value === true) {
        output += serializeTrueByOmission();
      } else {
        output += '=';
        output += serializeBareItem(value);
      }
      return output;
    })
    .join('');
}

function isStructuredFieldDictionary(
  bareItemRecordOrDictionary: StructuredFieldBareItemRecord | StructuredFieldDictionary
): bareItemRecordOrDictionary is StructuredFieldDictionary {
  const bareItemsOrItems = Object.values(bareItemRecordOrDictionary) as
    | StructuredFieldBareItem[]
    | StructuredFieldItem[];
  if (bareItemsOrItems.length === 0) {
    return true;
  }
  const bareItemOrItem = bareItemsOrItems[0]; // arbitrary
  // protect against null and array cases for `typeof bareItemOrItem === 'object'`
  return !!bareItemOrItem && typeof bareItemOrItem === 'object' && 'value' in bareItemOrItem;
}

export function convertToDictionary(
  bareItemRecordOrDictionary: StructuredFieldBareItemRecord | StructuredFieldDictionary
): StructuredFieldDictionary {
  if (isStructuredFieldDictionary(bareItemRecordOrDictionary)) {
    return bareItemRecordOrDictionary;
  } else {
    return Object.fromEntries(
      Object.entries(bareItemRecordOrDictionary).map(([key, bareItem]) => [
        key,
        { value: bareItem },
      ])
    );
  }
}
