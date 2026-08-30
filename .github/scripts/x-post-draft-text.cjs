'use strict';

const DEFAULT_MAX_LENGTH = 240;
const ELLIPSIS = '…';

function countCharacters(value) {
  return Array.from(value).length;
}

function truncateText(value, maxLength) {
  const text = value.trim();
  if (countCharacters(text) <= maxLength) {
    return text;
  }
  if (maxLength <= 0) {
    return '';
  }
  if (maxLength === 1) {
    return ELLIPSIS;
  }

  const prefix = Array.from(text).slice(0, maxLength - 1).join('').trimEnd();
  const lastWhitespace = Math.max(
    prefix.lastIndexOf(' '),
    prefix.lastIndexOf('\n'),
    prefix.lastIndexOf('\t'),
  );
  const minimumBoundary = Math.floor((maxLength - 1) * 0.65);
  const readablePrefix =
    lastWhitespace >= minimumBoundary
      ? prefix.slice(0, lastWhitespace).trimEnd()
      : prefix;

  return `${readablePrefix}${ELLIPSIS}`;
}

function fitXPostDraft(
  userFacingChange,
  userBenefit,
  maxLength = DEFAULT_MAX_LENGTH,
) {
  const change = userFacingChange.trim();
  const benefit = userBenefit.trim();
  if (!change || !benefit) {
    throw new Error('Both X post draft sections are required.');
  }

  const candidate = `${change}\n${benefit}`;
  if (countCharacters(candidate) <= maxLength) {
    return candidate;
  }

  const separatorLength = 1;
  const availableLength = maxLength - separatorLength;
  if (availableLength < 2) {
    throw new Error('X post draft limit is too small for both sections.');
  }

  let changeBudget = Math.floor(availableLength * 0.6);
  let benefitBudget = availableLength - changeBudget;
  const changeLength = countCharacters(change);
  const benefitLength = countCharacters(benefit);

  if (changeLength < changeBudget) {
    benefitBudget += changeBudget - changeLength;
    changeBudget = changeLength;
  }
  if (benefitLength < benefitBudget) {
    changeBudget += benefitBudget - benefitLength;
    benefitBudget = benefitLength;
  }

  const fitted = `${truncateText(change, changeBudget)}\n${truncateText(
    benefit,
    benefitBudget,
  )}`;
  if (countCharacters(fitted) > maxLength) {
    throw new Error('Fitted X post draft exceeds its character limit.');
  }

  return fitted;
}

module.exports = {
  countCharacters,
  fitXPostDraft,
  truncateText,
};
