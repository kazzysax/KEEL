import type { TokenOption } from './types';
export const USDT = { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 };
export const BSC = '56';
// Always re-verify on day one: docs/DEVEX-NOTES.md
// Source: github.com/ondoprotocol/ondo-global-markets-token-list, chainId 56 (459 tokens). Listed is not the same as liquid: confirm with a live quote.
export const REGISTRY: Record<string, TokenOption[]> = {
  AAPL: [{ issuer: 'Ondo', symbol: 'AAPLon', address: '0x390a684EF9cADE28A7AD0DFa61AB1Eb3842618c4', decimals: 18 }, { issuer: 'bStocks', symbol: 'AAPLB', address: '0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a', decimals: 18 }, { issuer: 'xStocks', symbol: 'AAPLx', address: '0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a', decimals: 18 }],
  MSFT: [{ issuer: 'Ondo', symbol: 'MSFTon', address: '0x6Bfe75D1ad432050eA973C3A3DcD88F02e2444C3', decimals: 18 }, { issuer: 'bStocks', symbol: 'MSFTB', address: '0x80106cb3ead06659a5ad19df39d9b4733863b9b0', decimals: 18 }, { issuer: 'xStocks', symbol: 'MSFTx', address: '0x5621737f42dae558b81269fcb9e9e70c19aa6b35', decimals: 18 }],
  SPY: [{ issuer: 'Ondo', symbol: 'SPYon', address: '0x6a708EAD771238919D85930b5a0f10454E1C331a', decimals: 18 }, { issuer: 'bStocks', symbol: 'SPYB', address: '0x7138b48df7d98d7e3cc221bfe7192d0a178182d8', decimals: 18 }, { issuer: 'xStocks', symbol: 'SPYx', address: '0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48', decimals: 18 }],
  QQQ: [{ issuer: 'Ondo', symbol: 'QQQon', address: '0x0cdE6936d305d5B34667fC46425E852efd73559a', decimals: 18 }, { issuer: 'bStocks', symbol: 'QQQB', address: '0x205812cdbed920aff76c6580abd681a46d11efc7', decimals: 18 }, { issuer: 'xStocks', symbol: 'QQQx', address: '0xa753a7395cae905cd615da0b82a53e0560f250af', decimals: 18 }],
  WMT: [{ issuer: 'Ondo', symbol: 'WMTon', address: '0xa7d1e886acf66Ec0656DF2DECB4B7C893A3bAb4C', decimals: 18 }, { issuer: 'xStocks', symbol: 'WMTx', address: '0x7aefc9965699fbea943e03264d96e50cd4a97b21', decimals: 18 }],
  KO: [{ issuer: 'Ondo', symbol: 'KOon', address: '0x405F38B90beBF1259062CF29Da299f3398662bcb', decimals: 18 }, { issuer: 'xStocks', symbol: 'KOx', address: '0xdcc1a2699441079da889b1f49e12b69cc791129b', decimals: 18 }],
  JNJ: [{ issuer: 'Ondo', symbol: 'JNJon', address: '0xD1f799Cb9F5D0A02951b0755bEcED6c43882712f', decimals: 18 }, { issuer: 'xStocks', symbol: 'JNJx', address: '0xdb0482cfad4789798623e64b15eeba01b16e917c', decimals: 18 }],
  COST: [{ issuer: 'Ondo', symbol: 'COSTon', address: '0x34375f826fD3dD4E15F883d4F4786bB45eb705ac', decimals: 18 }],
  XOM: [{ issuer: 'Ondo', symbol: 'XOMon', address: '0x4D209d275e3492AC08497a7a42915899c4DD5e86', decimals: 18 }, { issuer: 'xStocks', symbol: 'XOMx', address: '0xeedb0273c5af792745180e9ff568cd01550ffa13', decimals: 18 }],
  GLD: [{ issuer: 'Ondo', symbol: 'GLDon', address: '0xfA9A1e901085e269F6d428F79cD5252d8b919344', decimals: 18 }, { issuer: 'xStocks', symbol: 'GLDx', address: '0x2380f2673c640fb67e2d6b55b44c62f0e0e69da9', decimals: 18 }],
  SHY: [{ issuer: 'Ondo', symbol: 'SHYon', address: '0xf95e50BE5Efc96117c28775F80C7Cdb41Ebc4888', decimals: 18 }],
  IEF: [{ issuer: 'Ondo', symbol: 'IEFon', address: '0xA486a0A05250E8621bA3B26C3bbc517145eba619', decimals: 18 }],
  TLT: [{ issuer: 'Ondo', symbol: 'TLTon', address: '0xf69e40069aC227C11459E3f4e8a446b3401616b6', decimals: 18 }],
};
// Underlying ticker used to search the RWA catalogue
export const SEARCH_TICKER: Record<string, string> = Object.fromEntries(Object.keys(REGISTRY).map(k => [k, k]));
export const ISSUER_BY_PLATFORM: Record<string, TokenOption['issuer']> = {};
