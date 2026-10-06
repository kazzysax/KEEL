import type { TokenOption } from './types';
export const USDT = { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 };
export const BSC = '56';
// Always re-verify on day one: docs/DEVEX-NOTES.md
// Source: github.com/ondoprotocol/ondo-global-markets-token-list, chainId 56 (459 tokens). Listed is not the same as liquid: confirm with a live quote.
export const REGISTRY: Record<string, TokenOption[]> = {
  AAPL: [{ issuer: 'Ondo', symbol: 'AAPLon', address: '0x390a684EF9cADE28A7AD0DFa61AB1Eb3842618c4', decimals: 18 }, { issuer: 'bStocks', symbol: 'AAPLB', address: null, decimals: 18 }],
  MSFT: [{ issuer: 'Ondo', symbol: 'MSFTon', address: '0x6Bfe75D1ad432050eA973C3A3DcD88F02e2444C3', decimals: 18 }, { issuer: 'bStocks', symbol: 'MSFTB', address: null, decimals: 18 }],
  SPY: [{ issuer: 'Ondo', symbol: 'SPYon', address: '0x6a708EAD771238919D85930b5a0f10454E1C331a', decimals: 18 }, { issuer: 'bStocks', symbol: 'SPYB', address: null, decimals: 18 }],
  QQQ: [{ issuer: 'Ondo', symbol: 'QQQon', address: '0x0cdE6936d305d5B34667fC46425E852efd73559a', decimals: 18 }, { issuer: 'bStocks', symbol: 'QQQB', address: null, decimals: 18 }],
  WMT: [{ issuer: 'Ondo', symbol: 'WMTon', address: '0xa7d1e886acf66Ec0656DF2DECB4B7C893A3bAb4C', decimals: 18 }],
  KO: [{ issuer: 'Ondo', symbol: 'KOon', address: '0x405F38B90beBF1259062CF29Da299f3398662bcb', decimals: 18 }],
  JNJ: [{ issuer: 'Ondo', symbol: 'JNJon', address: '0xD1f799Cb9F5D0A02951b0755bEcED6c43882712f', decimals: 18 }],
  COST: [{ issuer: 'Ondo', symbol: 'COSTon', address: '0x34375f826fD3dD4E15F883d4F4786bB45eb705ac', decimals: 18 }],
  XOM: [{ issuer: 'Ondo', symbol: 'XOMon', address: '0x4D209d275e3492AC08497a7a42915899c4DD5e86', decimals: 18 }],
  GLD: [{ issuer: 'Ondo', symbol: 'GLDon', address: '0xfA9A1e901085e269F6d428F79cD5252d8b919344', decimals: 18 }],
  SHY: [{ issuer: 'Ondo', symbol: 'SHYon', address: '0xf95e50BE5Efc96117c28775F80C7Cdb41Ebc4888', decimals: 18 }],
  IEF: [{ issuer: 'Ondo', symbol: 'IEFon', address: '0xA486a0A05250E8621bA3B26C3bbc517145eba619', decimals: 18 }],
  TLT: [{ issuer: 'Ondo', symbol: 'TLTon', address: '0xf69e40069aC227C11459E3f4e8a446b3401616b6', decimals: 18 }],
};
// Underlying ticker used to search the RWA catalogue
export const SEARCH_TICKER: Record<string, string> = Object.fromEntries(Object.keys(REGISTRY).map(k => [k, k]));
export const ISSUER_BY_PLATFORM: Record<string, TokenOption['issuer']> = {};
