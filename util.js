import crypto from "crypto";
const DIFFICULTY = 3;

export function generateNextBlock(previousBlock, data) {
    const index = previousBlock.index + 1;
    const previousHash = previousBlock.hash;
    let nonce = 0;
    let hash;
    let timestamp;
    // proof-of-work
    do {
        timestamp = new Date().getTime();
        nonce = nonce + 1;
        hash = calculateHash(index, previousHash, timestamp, data, nonce);
    } while (!isValidHashDifficulty(hash));

    return {
        index: index,
        previousHash: previousBlock.hash,
        timestamp: timestamp,
        data: data,
        hash: hash,
        nonce: nonce
    };
}

export function calculateHash(index, previousHash, timestamp, data, nonce) {
    const blockData =
        index + previousHash + timestamp + data + nonce;

    return crypto
        .createHash("sha256")
        .update(blockData)
        .digest("hex");
}

export function isValidHashDifficulty(hash) {
    for (var i = 0, b = hash.length; i < b; i++) {
        if (hash[i] !== "0") {
            break;
        }
    }
    return i >= DIFFICULTY;
}

export function isValidNextBlock(nextBlock, previousBlock) {
    if (previousBlock.index + 1 !== nextBlock.index) {
        return false
    } else if (previousBlock.hash !== nextBlock.previousHash) {
        return false
    } else if (!isValidHashDifficulty(nextBlock.previousHash)) {
        return false
    } else if (!isValidHashDifficulty(nextBlock.hash)) {
        return false;
    }
    return true;
}

export function isValidChain(chain, genesisBlock) {
    if (JSON.stringify(chain[0]) !== JSON.stringify(genesisBlock)) {
        return false
    }

    const tempBlocks = [genesisBlock]
    for (let i = 1; i < chain.length; i = i + 1) {
        if (isValidNextBlock(chain[i], tempBlocks[i - 1])) {
            tempBlocks.push(chain[i]);
        } else {
            return false
        }
    }
    return true
}


// WEBPACK FOOTER //
// ./src/Mine/util.js

import {
    ADD_PEER,
    REMOVE_PEER,
    ADD_BLOCK,
    MUTATE_DATA,
    RE_MINE,
    ADD_MESSAGE,
    ADD_TRANSACTION,
    REMOVE_TRANSACTION,
    CONNECT_PEER,
    DISCONNECT_PEER,
    REPLACE_CHAIN,
    CHANGE_STEP
} from "./actions";
import { combineReducers } from "redux";
import { generateName } from "./util.js";
import { calculateHash } from "./Mine/util.js";

export function genesisBlock() {
    return {
        index: 0,
        previousHash: "0",
        timestamp: 1508270000000,
        data: "Welcome to Blockchain Demo 2.0!",
        hash: "000dc75a315c77a1f9c98fb6247d03dd18ac52632d7dc6a9920261d8109b37cf",
        nonce: 604
    }
};

function node(existingNames) {
    return {
        peer: generateName(existingNames),
        blockchain: [genesisBlock()],
        connectedPeers: []
    };
}

const initialNode = {
    peer: "Satoshi",
    blockchain: [genesisBlock()],
    connectedPeers: []
};

// block reducer
function blockchain(state = [initialNode], action) {
    switch (action.type) {
        case ADD_PEER:
            const existingNames = state.map(node => node.peer);
            return [...state, node(existingNames)];

        case REMOVE_PEER:
            const removePeer = state.filter(node => node.peer !== action.peer);
            return removePeer.map(node => {
                node.connectedPeers = node.connectedPeers.filter(
                    peer => peer.name !== action.peer
                );
                return node;
            });

        case ADD_BLOCK:
            return state.map(node => {
                if (node.peer === action.peer) {
                    node.blockchain = [...node.blockchain, action.block];
                }
                return node;
            });

        case MUTATE_DATA:
            return state.map(node => {
                const { peer, blockIndex, data } = action;
                if (node.peer === peer) {
                    console.log(peer, node.peer);
                    node.blockchain = node.blockchain.map((block, index) => {
                        if (index === blockIndex) {
                            block.data = data;
                            block.hash = calculateHash(
                                block.index,
                                block.previousHash,
                                block.timestamp,
                                block.data,
                                block.nonce
                            );
                        }
                        if (blockIndex < index) {
                            const previousHash = node.blockchain[index - 1].hash;
                            block.previousHash = previousHash;
                            block.hash = calculateHash(
                                block.index,
                                block.previousHash,
                                block.timestamp,
                                block.data,
                                block.nonce
                            );
                        }
                        return block;
                    });
                }
                return node;
            });

        case RE_MINE:
            return state.map(node => {
                const { peer, index, nonce, hash, timestamp } = action;
                if (node.peer === peer) {
                    node.blockchain = node.blockchain.map((_block, _index) => {
                        if (_index === index) {
                            _block.nonce = nonce;
                            _block.hash = hash;
                            _block.timestamp = timestamp;
                        }
                        if (index < _index) {
                            const previousHash = node.blockchain[_index - 1].hash;
                            _block.previousHash = previousHash;
                            _block.hash = calculateHash(
                                _block.index,
                                _block.previousHash,
                                _block.timestamp,
                                _block.node,
                                _block.nonce
                            );
                        }
                        return _block;
                    });
                }
                return node;
            });

        case CONNECT_PEER:
            return state.map(node => {
                if (node.peer === action.fromPeer) {
                    const newConnectedPeer = { name: action.toPeer, messages: [] };
                    node.connectedPeers = [...node.connectedPeers, newConnectedPeer];
                }
                return node;
            });

        case DISCONNECT_PEER:
            return state.map(node => {
                if (node.peer === action.fromPeer) {
                    node.connectedPeers = node.connectedPeers.filter(
                        peer => peer.name !== action.toPeer
                    );
                }
                return node;
            });

        case REPLACE_CHAIN:
            return state.map(node => {
                if (node.peer === action.peer) {
                    node.blockchain = action.chain;
                }
                return node;
            });

        case ADD_MESSAGE:
            return state.map(node => {
                if (node.peer === action.fromPeer) {
                    node.connectedPeers = node.connectedPeers.map(connectedPeer => {
                        if (connectedPeer.name === action.toPeer) {
                            connectedPeer.messages = [
                                ...connectedPeer.messages,
                                action.message
                            ];
                        }
                        return connectedPeer;
                    });
                }
                return node;
            });

        default:
            return state;
    }
}

function unconfirmedTransactions(state = [], action) {
    switch (action.type) {
        case ADD_TRANSACTION:
            return [...state, action.transaction];
        case REMOVE_TRANSACTION:
            return state.filter(tx => JSON.stringify(tx) !== action.transaction);
        default:
            return state;
    }
}

// Tour reducer
function step(state = 0, action) {
    switch (action.type) {
        case CHANGE_STEP:
            return action.step;
        default:
            return state;
    }
}

const reducers = combineReducers({
    blockchain,
    unconfirmedTransactions,
    step
});

export default reducers;

// on the component side

// dispatch => mine the new block
// dispatch => message mined new block, depending on valid chain or not
// check every peer on the blockchain
// if new block can be added => dispatch add new block
// if new block cant be added  => dispatch replace chain
// if new block same length => do nothing
// dispatch => peer's blockchain, new block



// WEBPACK FOOTER //
// ./src/reducers.js