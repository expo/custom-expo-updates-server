"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.truthy = exports.convertSHA256HashToUUID = exports.getExpoConfigAsync = exports.getMetadataAsync = exports.createNoUpdateAvailableDirectiveAsync = exports.createRollBackDirectiveAsync = exports.getAssetMetadataAsync = exports.getLatestUpdateBundlePathForRuntimeVersionAsync = exports.resolveAsset = exports.getAssetPathAsync = exports.updatesPath = exports.addSlashIfNeeded = exports.getPrivateKeyAsync = exports.signRSASHA256 = exports.convertToDictionaryItemsRepresentation = exports.NoUpdateAvailableError = void 0;
var crypto_1 = __importDefault(require("crypto"));
var fs_1 = __importDefault(require("fs"));
var promises_1 = __importDefault(require("fs/promises"));
var mime_1 = __importDefault(require("mime"));
var path_1 = __importDefault(require("path"));
var NoUpdateAvailableError = /** @class */ (function (_super) {
    __extends(NoUpdateAvailableError, _super);
    function NoUpdateAvailableError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return NoUpdateAvailableError;
}(Error));
exports.NoUpdateAvailableError = NoUpdateAvailableError;
function createHash(file, hashingAlgorithm, encoding) {
    return crypto_1.default.createHash(hashingAlgorithm).update(file).digest(encoding);
}
function getBase64URLEncoding(base64EncodedString) {
    return base64EncodedString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function convertToDictionaryItemsRepresentation(obj) {
    return new Map(Object.entries(obj).map(function (_a) {
        var k = _a[0], v = _a[1];
        return [k, [v, new Map()]];
    }));
}
exports.convertToDictionaryItemsRepresentation = convertToDictionaryItemsRepresentation;
function signRSASHA256(data, privateKey) {
    var sign = crypto_1.default.createSign('RSA-SHA256');
    sign.update(data, 'utf8');
    sign.end();
    return sign.sign(privateKey, 'base64');
}
exports.signRSASHA256 = signRSASHA256;
function getPrivateKeyAsync() {
    return __awaiter(this, void 0, void 0, function () {
        var privateKeyPath, pemBuffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    privateKeyPath = process.env.PRIVATE_KEY_PATH;
                    if (!privateKeyPath) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, promises_1.default.readFile(path_1.default.resolve(privateKeyPath))];
                case 1:
                    pemBuffer = _a.sent();
                    return [2 /*return*/, pemBuffer.toString('utf8')];
            }
        });
    });
}
exports.getPrivateKeyAsync = getPrivateKeyAsync;
var addSlashIfNeeded = function (str) { return str.endsWith('/') ? str : str + '/'; };
exports.addSlashIfNeeded = addSlashIfNeeded;
var updatesPath = function () { var _a; return (0, exports.addSlashIfNeeded)((_a = process.env.UPDATES_ASSET_PATH) !== null && _a !== void 0 ? _a : 'updates'); };
exports.updatesPath = updatesPath;
var getAssetPathAsync = function (assetPath) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, "".concat((0, exports.updatesPath)()).concat(assetPath)];
}); }); };
exports.getAssetPathAsync = getAssetPathAsync;
var resolveAsset = function (assetPath) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
    switch (_c.label) {
        case 0:
            _b = (_a = path_1.default).resolve;
            return [4 /*yield*/, (0, exports.getAssetPathAsync)(assetPath)];
        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
    }
}); }); };
exports.resolveAsset = resolveAsset;
function getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion) {
    return __awaiter(this, void 0, void 0, function () {
        var updatesDirectoryForRuntimeVersion, filesInUpdatesDirectory, directoriesInUpdatesDirectory;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, exports.getAssetPathAsync)(runtimeVersion)];
                case 1:
                    updatesDirectoryForRuntimeVersion = _a.sent();
                    if (!fs_1.default.existsSync(path_1.default.resolve(updatesDirectoryForRuntimeVersion))) {
                        throw new Error('Unsupported runtime version');
                    }
                    return [4 /*yield*/, promises_1.default.readdir(updatesDirectoryForRuntimeVersion)];
                case 2:
                    filesInUpdatesDirectory = _a.sent();
                    return [4 /*yield*/, Promise.all(filesInUpdatesDirectory.map(function (file) { return __awaiter(_this, void 0, void 0, function () {
                            var fileStat;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, promises_1.default.stat(path_1.default.join(updatesDirectoryForRuntimeVersion, file))];
                                    case 1:
                                        fileStat = _a.sent();
                                        return [2 /*return*/, fileStat.isDirectory() ? file : null];
                                }
                            });
                        }); }))];
                case 3:
                    directoriesInUpdatesDirectory = (_a.sent())
                        .filter(truthy)
                        .sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });
                    return [2 /*return*/, path_1.default.join(runtimeVersion, directoriesInUpdatesDirectory[0])];
            }
        });
    });
}
exports.getLatestUpdateBundlePathForRuntimeVersionAsync = getLatestUpdateBundlePathForRuntimeVersionAsync;
function getAssetMetadataAsync(arg) {
    return __awaiter(this, void 0, void 0, function () {
        var assetPath, absoluteAssetPath, asset, assetHash, key, keyExtensionSuffix, contentType;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    assetPath = "".concat(arg.updateBundlePath, "/").concat(arg.filePath);
                    return [4 /*yield*/, (0, exports.resolveAsset)(assetPath)];
                case 1:
                    absoluteAssetPath = _a.sent();
                    return [4 /*yield*/, promises_1.default.readFile(absoluteAssetPath, null)];
                case 2:
                    asset = _a.sent();
                    assetHash = getBase64URLEncoding(createHash(asset, 'sha256', 'base64'));
                    key = createHash(asset, 'md5', 'hex');
                    keyExtensionSuffix = arg.isLaunchAsset ? 'bundle' : arg.ext;
                    contentType = arg.isLaunchAsset ? 'application/javascript' : mime_1.default.getType(arg.ext);
                    return [2 /*return*/, {
                            hash: assetHash,
                            key: key,
                            fileExtension: ".".concat(keyExtensionSuffix),
                            contentType: contentType,
                            url: "".concat(process.env.HOSTNAME, "/api/assets?asset=").concat(assetPath, "&runtimeVersion=").concat(arg.runtimeVersion, "&platform=").concat(arg.platform),
                        }];
            }
        });
    });
}
exports.getAssetMetadataAsync = getAssetMetadataAsync;
function createRollBackDirectiveAsync(updateBundlePath) {
    return __awaiter(this, void 0, void 0, function () {
        var rollbackFilePath, rollbackFileStat, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, (0, exports.resolveAsset)("".concat(updateBundlePath, "/rollback"))];
                case 1:
                    rollbackFilePath = _a.sent();
                    return [4 /*yield*/, promises_1.default.stat(rollbackFilePath)];
                case 2:
                    rollbackFileStat = _a.sent();
                    return [2 /*return*/, {
                            type: 'rollBackToEmbedded',
                            parameters: {
                                commitTime: new Date(rollbackFileStat.birthtime).toISOString(),
                            },
                        }];
                case 3:
                    error_1 = _a.sent();
                    throw new Error("No rollback found. Error: ".concat(error_1));
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.createRollBackDirectiveAsync = createRollBackDirectiveAsync;
function createNoUpdateAvailableDirectiveAsync() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    type: 'noUpdateAvailable',
                }];
        });
    });
}
exports.createNoUpdateAvailableDirectiveAsync = createNoUpdateAvailableDirectiveAsync;
function getMetadataAsync(_a) {
    var updateBundlePath = _a.updateBundlePath, runtimeVersion = _a.runtimeVersion;
    return __awaiter(this, void 0, void 0, function () {
        var metadataPath, updateMetadataBuffer, metadataJson, metadataStat, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, (0, exports.resolveAsset)("".concat(updateBundlePath, "/metadata.json"))];
                case 1:
                    metadataPath = _b.sent();
                    return [4 /*yield*/, promises_1.default.readFile(path_1.default.resolve(metadataPath), null)];
                case 2:
                    updateMetadataBuffer = _b.sent();
                    metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
                    return [4 /*yield*/, promises_1.default.stat(metadataPath)];
                case 3:
                    metadataStat = _b.sent();
                    return [2 /*return*/, {
                            metadataJson: metadataJson,
                            createdAt: new Date(metadataStat.birthtime).toISOString(),
                            id: createHash(updateMetadataBuffer, 'sha256', 'hex'),
                        }];
                case 4:
                    error_2 = _b.sent();
                    throw new Error("No update found with runtime version: ".concat(runtimeVersion, ". Error: ").concat(error_2));
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.getMetadataAsync = getMetadataAsync;
/**
 * This adds the `@expo/config`-exported config to `extra.expoConfig`, which is a common thing
 * done by implementors of the expo-updates specification since a lot of Expo modules use it.
 * It is not required by the specification, but is included here in the example client and server
 * for demonstration purposes. EAS Update does something conceptually very similar.
 */
function getExpoConfigAsync(_a) {
    var updateBundlePath = _a.updateBundlePath, runtimeVersion = _a.runtimeVersion;
    return __awaiter(this, void 0, void 0, function () {
        var expoConfigPath, expoConfigBuffer, expoConfigJson, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, (0, exports.resolveAsset)("".concat(updateBundlePath, "/expoConfig.json"))];
                case 1:
                    expoConfigPath = _b.sent();
                    return [4 /*yield*/, promises_1.default.readFile(path_1.default.resolve(expoConfigPath), null)];
                case 2:
                    expoConfigBuffer = _b.sent();
                    expoConfigJson = JSON.parse(expoConfigBuffer.toString('utf-8'));
                    return [2 /*return*/, expoConfigJson];
                case 3:
                    error_3 = _b.sent();
                    throw new Error("No expo config json found with runtime version: ".concat(runtimeVersion, ". Error: ").concat(error_3));
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.getExpoConfigAsync = getExpoConfigAsync;
function convertSHA256HashToUUID(value) {
    return "".concat(value.slice(0, 8), "-").concat(value.slice(8, 12), "-").concat(value.slice(12, 16), "-").concat(value.slice(16, 20), "-").concat(value.slice(20, 32));
}
exports.convertSHA256HashToUUID = convertSHA256HashToUUID;
function truthy(value) {
    return !!value;
}
exports.truthy = truthy;
