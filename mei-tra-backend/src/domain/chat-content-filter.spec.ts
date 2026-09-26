import { isObjectionableChatContent } from './chat-content-filter';

describe('chat content filter', () => {
  it('rejects obvious abuse even with full-width letters or separators', () => {
    expect(isObjectionableChatContent('Ｋ・Ｉ・Ｌ・Ｌ yourself')).toBe(true);
    expect(isObjectionableChatContent('し ね')).toBe(true);
  });

  it('allows ordinary game conversation', () => {
    expect(isObjectionableChatContent('次はスペードを出します')).toBe(false);
    expect(isObjectionableChatContent('Nice play!')).toBe(false);
    expect(
      isObjectionableChatContent('The cards are draped on the table'),
    ).toBe(false);
  });
});
