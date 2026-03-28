/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/anchor.json`.
 */
export type Anchor = {
  "address": "7RyLCWzdDQkMCmGpFKp5tXmTdXL8BhYKUMmA4nq88uRF",
  "metadata": {
    "name": "anchor",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptBattle",
      "discriminator": [
        152,
        117,
        160,
        50,
        174,
        219,
        153,
        148
      ],
      "accounts": [
        {
          "name": "opponent",
          "docs": [
            "Opponent (signer) accepting the battle"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "opponentMint",
          "docs": [
            "Opponent NFT mint"
          ]
        },
        {
          "name": "opponentTokenAccount",
          "docs": [
            "Opponent NFT token account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "opponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "opponentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "opponentEscrow",
          "docs": [
            "Create escrow for the Opponents NFT"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "battle"
              },
              {
                "kind": "account",
                "path": "opponentMint"
              }
            ]
          }
        },
        {
          "name": "battle",
          "docs": [
            "Battle PDA"
          ],
          "writable": true
        },
        {
          "name": "signerFighter",
          "docs": [
            "Signers Fighter PDA derived from their NFT mint"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  105,
                  103,
                  104,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "battle.signer_nft",
                "account": "battle"
              }
            ]
          }
        },
        {
          "name": "opponentFighter",
          "docs": [
            "Opponent Fighter PDA derived from their NFT mint"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  105,
                  103,
                  104,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "opponentMint"
              }
            ]
          }
        },
        {
          "name": "battleSigner",
          "docs": [
            "Required for signers_opponent_ata"
          ]
        },
        {
          "name": "signersOpponentAta",
          "docs": [
            "Signers token account for opponents NFT mint (derived from signer + opponent_mint)",
            "Used if the signer wins"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "battleSigner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "opponentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "signerNftMint",
          "docs": [
            "Signers NFT mint, Required for opponents_signer_ata"
          ]
        },
        {
          "name": "opponentsSignerAta",
          "docs": [
            "Opponents token account for signers NFT mint (derived from opponent + signer_mint)",
            "Used if the opponent wins"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "opponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "signerNftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "Program accounts needed"
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "cancelBattle",
      "discriminator": [
        234,
        61,
        97,
        187,
        97,
        170,
        101,
        141
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Original battle PDA creator"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "signerMint",
          "docs": [
            "The NFT mint of signers fighter"
          ]
        },
        {
          "name": "signerTokenAccount",
          "docs": [
            "Signers token account to receive the NFT back"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "signerMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "signerEscrow",
          "docs": [
            "Escrow holding the signers NFT"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "battle"
              },
              {
                "kind": "account",
                "path": "signerMint"
              }
            ]
          }
        },
        {
          "name": "battle",
          "docs": [
            "Battle PDA, must be Pending status and owned by signer"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "signerMint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Program accounts needed"
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "createBattle",
      "discriminator": [
        2,
        249,
        54,
        216,
        42,
        99,
        187,
        102
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Signer (battle initiator)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "signerMint",
          "docs": [
            "The NFT mint of Signer fighter"
          ]
        },
        {
          "name": "signerTokenAccount",
          "docs": [
            "Signer token account holding the fighter NFT"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "signerMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "signerEscrow",
          "docs": [
            "Create escrow for the Signer NFT"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "battle"
              },
              {
                "kind": "account",
                "path": "signerMint"
              }
            ]
          }
        },
        {
          "name": "battle",
          "docs": [
            "Create Battle PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "signerMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "Program accounts needed"
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "opponent",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "opponentNft",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "battleMode",
          "type": {
            "defined": {
              "name": "battleMode"
            }
          }
        },
        {
          "name": "minPower",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "maxPower",
          "type": {
            "option": "u16"
          }
        }
      ]
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "address": "2QZvzZ4XszjtBiPKMy7wb3YZ4EwbRTovbDki99c4Cr87"
        },
        {
          "name": "config",
          "docs": [
            "Create config PDA storing our merkle root"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "Program accounts needed"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "merkleRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "collectionMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeFighter",
      "discriminator": [
        112,
        199,
        127,
        34,
        80,
        255,
        234,
        168
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "Signer"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config PDA for merkle root"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fighter",
          "docs": [
            "Fighter PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  105,
                  103,
                  104,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "fighterMint"
              }
            ]
          }
        },
        {
          "name": "fighterMint",
          "docs": [
            "NFT mint"
          ]
        },
        {
          "name": "fighterMetadata",
          "docs": [
            "Get metadata to check collection id"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "const",
                "value": [
                  11,
                  112,
                  101,
                  177,
                  227,
                  209,
                  124,
                  69,
                  56,
                  157,
                  82,
                  127,
                  107,
                  4,
                  195,
                  205,
                  88,
                  184,
                  108,
                  115,
                  26,
                  160,
                  253,
                  181,
                  73,
                  182,
                  209,
                  188,
                  3,
                  248,
                  41,
                  70
                ]
              },
              {
                "kind": "account",
                "path": "fighterMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                11,
                112,
                101,
                177,
                227,
                209,
                124,
                69,
                56,
                157,
                82,
                127,
                107,
                4,
                195,
                205,
                88,
                184,
                108,
                115,
                26,
                160,
                253,
                181,
                73,
                182,
                209,
                188,
                3,
                248,
                41,
                70
              ]
            }
          }
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "NFT token account"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "fighterMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Program accounts needed"
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "power",
          "type": "u16"
        },
        {
          "name": "proof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      "name": "resolveBattle",
      "discriminator": [
        112,
        191,
        142,
        62,
        126,
        119,
        170,
        54
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "address": "2QZvzZ4XszjtBiPKMy7wb3YZ4EwbRTovbDki99c4Cr87"
        },
        {
          "name": "battle",
          "docs": [
            "Battle PDA, close at end of instruction",
            "enforce slot hash delay into constraint"
          ],
          "writable": true
        },
        {
          "name": "battleSigner",
          "docs": [
            "Required for signer_token_account"
          ],
          "writable": true
        },
        {
          "name": "battleOpponent",
          "docs": [
            "Required for opponent_token_account"
          ],
          "writable": true
        },
        {
          "name": "signerEscrow",
          "docs": [
            "Signers fighter escrow"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "battle"
              },
              {
                "kind": "account",
                "path": "battle.signer_nft",
                "account": "battle"
              }
            ]
          }
        },
        {
          "name": "opponentEscrow",
          "docs": [
            "Opponent fighter escrow"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "battle"
              },
              {
                "kind": "account",
                "path": "battle.opponent_nft.ok_or(FighterError :: BattleNotAccepted) ? ",
                "account": "battle"
              }
            ]
          }
        },
        {
          "name": "signerTokenAccount",
          "docs": [
            "Signer NFT token account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "battleSigner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "signerNftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "opponentTokenAccount",
          "docs": [
            "Opponent NFT token account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "battleOpponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "opponentNftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "signerNftMint",
          "docs": [
            "Signers NFT mint, Required for signer_token_account and opponents_signer_ata."
          ]
        },
        {
          "name": "opponentNftMint",
          "docs": [
            "Opponents NFT mint, Required for opponent_token_account and signers_opponent_ata."
          ]
        },
        {
          "name": "signersOpponentAta",
          "docs": [
            "Signers ATA for the opponents NFT mint.",
            "Receives opponents NFT if signer wins and mode is PinkSlip."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "battleSigner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "opponentNftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "opponentsSignerAta",
          "docs": [
            "Opponents ATA for the signers NFT mint.",
            "Receives signers NFT if signer wins and mode is PinkSlip."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "battleOpponent"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "signerNftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "signerFighter",
          "docs": [
            "Signers Fighter PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  105,
                  103,
                  104,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "battle.signer_nft",
                "account": "battle"
              }
            ]
          }
        },
        {
          "name": "opponentFighter",
          "docs": [
            "Opponents Fighter PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  105,
                  103,
                  104,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "battle.opponent_nft.ok_or(FighterError :: BattleNotAccepted) ? ",
                "account": "battle"
              }
            ]
          }
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "docs": [
            "Program accounts needed"
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "address": "2QZvzZ4XszjtBiPKMy7wb3YZ4EwbRTovbDki99c4Cr87"
        },
        {
          "name": "config",
          "docs": [
            "Create config PDA storing our merkle root"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "merkleRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "collectionMint",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "battle",
      "discriminator": [
        81,
        148,
        121,
        71,
        63,
        166,
        116,
        24
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "fighter",
      "discriminator": [
        24,
        221,
        27,
        113,
        60,
        210,
        101,
        211
      ]
    }
  ],
  "events": [
    {
      "name": "battleAccepted",
      "discriminator": [
        131,
        127,
        173,
        49,
        177,
        251,
        29,
        74
      ]
    },
    {
      "name": "battleBiteResult",
      "discriminator": [
        12,
        128,
        22,
        204,
        139,
        35,
        30,
        120
      ]
    },
    {
      "name": "battleCancelled",
      "discriminator": [
        52,
        123,
        54,
        137,
        90,
        187,
        138,
        60
      ]
    },
    {
      "name": "battleCreated",
      "discriminator": [
        33,
        66,
        118,
        96,
        130,
        0,
        113,
        218
      ]
    },
    {
      "name": "battleResolved",
      "discriminator": [
        47,
        156,
        226,
        94,
        163,
        176,
        162,
        241
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "fighterInitialized",
      "discriminator": [
        126,
        179,
        26,
        121,
        70,
        25,
        132,
        60
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "fighterAlreadyInBattle",
      "msg": "This fighter already has a pending battle"
    },
    {
      "code": 6001,
      "name": "battleNotPending",
      "msg": "Battle is not in pending status"
    },
    {
      "code": 6002,
      "name": "battleNotAccepted",
      "msg": "Battle is not in accepted status"
    },
    {
      "code": 6003,
      "name": "unauthorizedCancel",
      "msg": "Only the battle creator can cancel"
    },
    {
      "code": 6004,
      "name": "cannotAcceptOwnBattle",
      "msg": "Cannot accept your own battle"
    },
    {
      "code": 6005,
      "name": "invalidBattleMode",
      "msg": "Invalid battle mode"
    },
    {
      "code": 6006,
      "name": "unauthorizedFighter",
      "msg": "User does not own this fighter NFT"
    },
    {
      "code": 6007,
      "name": "battleAlreadyAccepted",
      "msg": "Battle has already been accepted"
    },
    {
      "code": 6008,
      "name": "invalidNftMint",
      "msg": "Invalid NFT mint"
    },
    {
      "code": 6009,
      "name": "invalidOpponentDeclaration",
      "msg": "Opponent and opponent_nft must both be specified or both be None"
    },
    {
      "code": 6010,
      "name": "invalidOpponent",
      "msg": "Invalid opponent"
    },
    {
      "code": 6011,
      "name": "invalidOpponentNft",
      "msg": "Wrong fighter selected"
    },
    {
      "code": 6012,
      "name": "invalidPowerRange",
      "msg": "Fighter power level out of range"
    },
    {
      "code": 6013,
      "name": "invalidProof",
      "msg": "Merkle proof is invalid for the provided attributes"
    },
    {
      "code": 6014,
      "name": "unauthorized",
      "msg": "Unauthorized instruction"
    },
    {
      "code": 6015,
      "name": "battleNotReadyToResolve",
      "msg": "Battle cannot be resolved yet"
    },
    {
      "code": 6016,
      "name": "zeroPowerFighter",
      "msg": "Fighter power cannot be zero"
    },
    {
      "code": 6017,
      "name": "noChanges",
      "msg": "No changes to be made in the config"
    }
  ],
  "types": [
    {
      "name": "battle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "opponent",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "signerNft",
            "type": "pubkey"
          },
          {
            "name": "opponentNft",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "signerPower",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "opponentPower",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "battleMode",
            "type": {
              "defined": {
                "name": "battleMode"
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "battleStatus"
              }
            }
          },
          {
            "name": "minPower",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "maxPower",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "acceptedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "acceptedSlot",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "randomSeed",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "battleAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "battle",
            "type": "pubkey"
          },
          {
            "name": "signerNft",
            "type": "pubkey"
          },
          {
            "name": "opponent",
            "type": "pubkey"
          },
          {
            "name": "opponentNft",
            "type": "pubkey"
          },
          {
            "name": "acceptedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "battleBiteResult",
      "docs": [
        "Event emitted for Bite mode battle result"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "battle",
            "type": "pubkey"
          },
          {
            "name": "winnerNft",
            "type": "pubkey"
          },
          {
            "name": "loserNft",
            "type": "pubkey"
          },
          {
            "name": "winnerNewPower",
            "type": "u16"
          },
          {
            "name": "loserNewPower",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "battleCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "battle",
            "type": "pubkey"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "signerNft",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "battleCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "battle",
            "type": "pubkey"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "signerNft",
            "type": "pubkey"
          },
          {
            "name": "opponent",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "opponentNft",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "battleMode",
            "type": {
              "defined": {
                "name": "battleMode"
              }
            }
          }
        ]
      }
    },
    {
      "name": "battleMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pinkSlip"
          },
          {
            "name": "bite"
          }
        ]
      }
    },
    {
      "name": "battleResolved",
      "docs": [
        "Event emitted when a battle resolves"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "battle",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "battleMode",
            "type": {
              "defined": {
                "name": "battleMode"
              }
            }
          },
          {
            "name": "signerFighter",
            "type": "pubkey"
          },
          {
            "name": "opponentFighter",
            "type": "pubkey"
          },
          {
            "name": "signerPower",
            "type": "u16"
          },
          {
            "name": "opponentPower",
            "type": "u16"
          },
          {
            "name": "randomSeed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "battleStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "accepted"
          },
          {
            "name": "completed"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "collectionMint",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "collectionMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "fighter",
      "docs": [
        "Fighter - The source of truth for all fighter data",
        "This is created when a fighter NFT is minted",
        "Only the program can update this"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The NFT mint address for this fighter"
            ],
            "type": "pubkey"
          },
          {
            "name": "power",
            "docs": [
              "Fighter's power level (used in battle probability)"
            ],
            "type": "u16"
          },
          {
            "name": "wins",
            "docs": [
              "Total wins"
            ],
            "type": "u32"
          },
          {
            "name": "losses",
            "docs": [
              "Total losses"
            ],
            "type": "u32"
          },
          {
            "name": "createdAt",
            "docs": [
              "Created timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "fighterInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "power",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "battleSeed",
      "docs": [
        "Seed for battle PDA",
        "Battle PDA: [BATTLE_SEED, fighter_a_mint.key().as_ref()]"
      ],
      "type": "bytes",
      "value": "[98, 97, 116, 116, 108, 101]"
    },
    {
      "name": "configSeed",
      "docs": [
        "Seed for config"
      ],
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "escrowSeed",
      "docs": [
        "Seed for fighter escrow token account",
        "Escrow PDA: [ESCROW_SEED, battle.key().as_ref(), fighter_mint.key().as_ref()]"
      ],
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119]"
    },
    {
      "name": "fighterSeed",
      "docs": [
        "Seed for fighter pda",
        "Escrow PDA: [FIGHTER_SEED, fighter_mint.key().as_ref()]"
      ],
      "type": "bytes",
      "value": "[102, 105, 103, 104, 116, 101, 114]"
    }
  ]
};
