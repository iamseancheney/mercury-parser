import 'babel-polyfill';

import URL from 'url';
import request from 'request';

import {
  REQUEST_HEADERS,
  FETCH_TIMEOUT,
  BAD_CONTENT_TYPES_RE,
  MAX_CONTENT_LENGTH,
} from './constants';

function get(options) {
  return new Promise((resolve, reject) => {
    request(options, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({ body, response });
      }
    });
  });
}

// Evaluate a response to ensure it's something we should be keeping.
// This does not validate in the sense of a response being 200 level or
// not. Validation here means that we haven't found reason to bail from
// further processing of this url.

export function validateResponse(response, parseNon2xx = false) {
  // Check if we got a valid status code
  if (response.statusMessage !== 'OK') {
    if (!response.statusCode) {
      throw new Error(
        `Unable to fetch content. Original exception was ${response.error}`
      );
    } else if (!parseNon2xx) {
      throw new Error(
        `Resource returned a response status code of ${response.statusCode} and resource was instructed to reject non-2xx level status codes.`
      );
    }
  }

  const {
    'content-type': contentType,
    'content-length': contentLength,
  } = response.headers;

  // Check that the content is not in BAD_CONTENT_TYPES
  if (BAD_CONTENT_TYPES_RE.test(contentType)) {
    throw new Error(
      `Content-type for this resource was ${contentType} and is not allowed.`
    );
  }

  // Check that the content length is below maximum
  if (contentLength > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Content for this resource was too large. Maximum content length is ${MAX_CONTENT_LENGTH}.`
    );
  }

  return true;
}

// Grabs the last two pieces of the URL and joins them back together
// This is to get the 'livejournal.com' from 'erotictrains.livejournal.com'
export function baseDomain({ host }) {
  return host.split('.').slice(-2).join('.');
}

// Set our response attribute to the result of fetching our URL.
// TODO: This should gracefully handle timeouts and raise the
//       proper exceptions on the many failure cases of HTTP.
// TODO: Ensure we are not fetching something enormous. Always return
//       unicode content for HTML, with charset conversion.

export default async function fetchResource(url) {
  const parsedUrl = URL.parse(url);

  const options = {
    url: parsedUrl,
    headers: { ...REQUEST_HEADERS },
    timeout: FETCH_TIMEOUT,
    // Don't set encoding; this fixes issues
    // w/gzipped responses
    encoding: null,
    // Accept cookies
    jar: true,
  };

  const { response, body } = await get(options);

  try {
    validateResponse(response);
    return { body, response };
  } catch (e) {
    return e;
  }
}