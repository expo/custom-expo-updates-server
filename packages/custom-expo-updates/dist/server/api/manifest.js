"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var form_data_1 = __importDefault(require("form-data"));
var promises_1 = __importDefault(require("fs/promises"));
var structured_headers_1 = require("structured-headers");
var helpers_1 = require("../common/helpers");
function manifestEndpoint(req, res, next) {
    var _a, _b;
    if (next === void 0) { next = function () { }; }
    return __awaiter(this, void 0, void 0, function () {
        var protocolVersionMaybeArray, protocolVersion, platform, runtimeVersion, updateBundlePath, error_1, updateType, maybeNoUpdateAvailableError_1, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (req.method !== 'GET') {
                        res.statusCode = 405;
                        res.json({ error: 'Expected GET.' });
                        return [2 /*return*/];
                    }
                    protocolVersionMaybeArray = req.headers['expo-protocol-version'];
                    if (protocolVersionMaybeArray && Array.isArray(protocolVersionMaybeArray)) {
                        res.statusCode = 400;
                        res.json({
                            error: 'Unsupported protocol version. Expected either 0 or 1.',
                        });
                        return [2 /*return*/];
                    }
                    protocolVersion = parseInt(protocolVersionMaybeArray !== null && protocolVersionMaybeArray !== void 0 ? protocolVersionMaybeArray : '0', 10);
                    platform = (_a = req.headers['expo-platform']) !== null && _a !== void 0 ? _a : req.query['platform'];
                    if (platform !== 'ios' && platform !== 'android') {
                        res.statusCode = 400;
                        res.json({
                            error: 'Unsupported platform. Expected either ios or android.',
                        });
                        return [2 /*return*/];
                    }
                    runtimeVersion = (_b = req.headers['expo-runtime-version']) !== null && _b !== void 0 ? _b : req.query['runtime-version'];
                    if (!runtimeVersion || typeof runtimeVersion !== 'string') {
                        res.statusCode = 400;
                        res.json({
                            error: 'No runtimeVersion provided.',
                        });
                        return [2 /*return*/];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, helpers_1.getLatestUpdateBundlePathForRuntimeVersionAsync)(runtimeVersion)];
                case 2:
                    updateBundlePath = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _c.sent();
                    res.statusCode = 404;
                    res.json({
                        error: error_1.message,
                    });
                    return [2 /*return*/];
                case 4: return [4 /*yield*/, getTypeOfUpdateAsync(updateBundlePath)];
                case 5:
                    updateType = _c.sent();
                    _c.label = 6;
                case 6:
                    _c.trys.push([6, 16, , 17]);
                    _c.label = 7;
                case 7:
                    _c.trys.push([7, 12, , 15]);
                    if (!(updateType === UpdateType.NORMAL_UPDATE)) return [3 /*break*/, 9];
                    return [4 /*yield*/, putUpdateInResponseAsync(req, res, updateBundlePath, runtimeVersion, platform, protocolVersion)];
                case 8:
                    _c.sent();
                    return [3 /*break*/, 11];
                case 9:
                    if (!(updateType === UpdateType.ROLLBACK)) return [3 /*break*/, 11];
                    return [4 /*yield*/, putRollBackInResponseAsync(req, res, updateBundlePath, protocolVersion)];
                case 10:
                    _c.sent();
                    _c.label = 11;
                case 11: return [3 /*break*/, 15];
                case 12:
                    maybeNoUpdateAvailableError_1 = _c.sent();
                    if (!(maybeNoUpdateAvailableError_1 instanceof helpers_1.NoUpdateAvailableError)) return [3 /*break*/, 14];
                    return [4 /*yield*/, putNoUpdateAvailableInResponseAsync(req, res, protocolVersion)];
                case 13:
                    _c.sent();
                    return [2 /*return*/];
                case 14: throw maybeNoUpdateAvailableError_1;
                case 15: return [3 /*break*/, 17];
                case 16:
                    error_2 = _c.sent();
                    // console.error(error);
                    res.statusCode = 404;
                    res.json({ error: error_2 });
                    return [3 /*break*/, 17];
                case 17: return [2 /*return*/];
            }
        });
    });
}
exports.default = manifestEndpoint;
var UpdateType;
(function (UpdateType) {
    UpdateType[UpdateType["NORMAL_UPDATE"] = 0] = "NORMAL_UPDATE";
    UpdateType[UpdateType["ROLLBACK"] = 1] = "ROLLBACK";
})(UpdateType || (UpdateType = {}));
function getTypeOfUpdateAsync(updateBundlePath) {
    return __awaiter(this, void 0, void 0, function () {
        var directoryContents;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, promises_1.default.readdir(updateBundlePath)];
                case 1:
                    directoryContents = _a.sent();
                    return [2 /*return*/, directoryContents.includes('rollback') ? UpdateType.ROLLBACK : UpdateType.NORMAL_UPDATE];
            }
        });
    });
}
function putUpdateInResponseAsync(req, res, updateBundlePath, runtimeVersion, platform, protocolVersion) {
    return __awaiter(this, void 0, void 0, function () {
        var currentUpdateId, _a, metadataJson, createdAt, id, expoConfig, platformSpecificMetadata, manifest, signature, expectSignatureHeader, privateKey, manifestString, hashSignature, dictionary, assetRequestHeaders, form;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUpdateId = req.headers['expo-current-update-id'];
                    return [4 /*yield*/, (0, helpers_1.getMetadataAsync)({
                            updateBundlePath: updateBundlePath,
                            runtimeVersion: runtimeVersion,
                        })];
                case 1:
                    _a = _c.sent(), metadataJson = _a.metadataJson, createdAt = _a.createdAt, id = _a.id;
                    // NoUpdateAvailable directive only supported on protocol version 1
                    // for protocol version 0, serve most recent update as normal
                    if (currentUpdateId === id && protocolVersion === 1) {
                        throw new helpers_1.NoUpdateAvailableError();
                    }
                    return [4 /*yield*/, (0, helpers_1.getExpoConfigAsync)({
                            updateBundlePath: updateBundlePath,
                            runtimeVersion: runtimeVersion,
                        })];
                case 2:
                    expoConfig = _c.sent();
                    platformSpecificMetadata = metadataJson.fileMetadata[platform];
                    _b = {
                        id: (0, helpers_1.convertSHA256HashToUUID)(id),
                        createdAt: createdAt,
                        runtimeVersion: runtimeVersion
                    };
                    return [4 /*yield*/, Promise.all(platformSpecificMetadata.assets.map(function (asset) {
                            return (0, helpers_1.getAssetMetadataAsync)({
                                updateBundlePath: updateBundlePath,
                                filePath: asset.path,
                                ext: asset.ext,
                                runtimeVersion: runtimeVersion,
                                platform: platform,
                                isLaunchAsset: false,
                            });
                        }))];
                case 3:
                    _b.assets = _c.sent();
                    return [4 /*yield*/, (0, helpers_1.getAssetMetadataAsync)({
                            updateBundlePath: updateBundlePath,
                            filePath: platformSpecificMetadata.bundle,
                            isLaunchAsset: true,
                            runtimeVersion: runtimeVersion,
                            platform: platform,
                            ext: null,
                        })];
                case 4:
                    manifest = (_b.launchAsset = _c.sent(),
                        _b.metadata = {},
                        _b.extra = {
                            expoClient: expoConfig,
                        },
                        _b);
                    signature = null;
                    expectSignatureHeader = req.headers['expo-expect-signature'];
                    if (!expectSignatureHeader) return [3 /*break*/, 6];
                    return [4 /*yield*/, (0, helpers_1.getPrivateKeyAsync)()];
                case 5:
                    privateKey = _c.sent();
                    if (!privateKey) {
                        res.statusCode = 400;
                        res.json({
                            error: 'Code signing requested but no key supplied when starting server.',
                        });
                        return [2 /*return*/];
                    }
                    manifestString = JSON.stringify(manifest);
                    hashSignature = (0, helpers_1.signRSASHA256)(manifestString, privateKey);
                    dictionary = (0, helpers_1.convertToDictionaryItemsRepresentation)({
                        sig: hashSignature,
                        keyid: 'main',
                    });
                    signature = (0, structured_headers_1.serializeDictionary)(dictionary);
                    _c.label = 6;
                case 6:
                    assetRequestHeaders = {};
                    __spreadArray(__spreadArray([], manifest.assets, true), [manifest.launchAsset], false).forEach(function (asset) {
                        assetRequestHeaders[asset.key] = {
                            'test-header': 'test-header-value',
                        };
                    });
                    form = new form_data_1.default();
                    form.append('manifest', JSON.stringify(manifest), {
                        contentType: 'application/json',
                        header: __assign({ 'content-type': 'application/json; charset=utf-8' }, (signature ? { 'expo-signature': signature } : {})),
                    });
                    form.append('extensions', JSON.stringify({ assetRequestHeaders: assetRequestHeaders }), {
                        contentType: 'application/json',
                    });
                    res.statusCode = 200;
                    res.setHeader('expo-protocol-version', protocolVersion);
                    res.setHeader('expo-sfv-version', 0);
                    res.setHeader('cache-control', 'private, max-age=0');
                    res.setHeader('content-type', "multipart/mixed; boundary=".concat(form.getBoundary()));
                    res.write(form.getBuffer());
                    res.end();
                    return [2 /*return*/];
            }
        });
    });
}
function putRollBackInResponseAsync(req, res, updateBundlePath, protocolVersion) {
    return __awaiter(this, void 0, void 0, function () {
        var embeddedUpdateId, currentUpdateId, directive, signature, expectSignatureHeader, privateKey, directiveString, hashSignature, dictionary, form;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (protocolVersion === 0) {
                        throw new Error('Rollbacks not supported on protocol version 0');
                    }
                    embeddedUpdateId = req.headers['expo-embedded-update-id'];
                    if (!embeddedUpdateId || typeof embeddedUpdateId !== 'string') {
                        throw new Error('Invalid Expo-Embedded-Update-ID request header specified.');
                    }
                    currentUpdateId = req.headers['expo-current-update-id'];
                    if (currentUpdateId === embeddedUpdateId) {
                        throw new helpers_1.NoUpdateAvailableError();
                    }
                    return [4 /*yield*/, (0, helpers_1.createRollBackDirectiveAsync)(updateBundlePath)];
                case 1:
                    directive = _a.sent();
                    signature = null;
                    expectSignatureHeader = req.headers['expo-expect-signature'];
                    if (!expectSignatureHeader) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, helpers_1.getPrivateKeyAsync)()];
                case 2:
                    privateKey = _a.sent();
                    if (!privateKey) {
                        res.statusCode = 400;
                        res.json({
                            error: 'Code signing requested but no key supplied when starting server.',
                        });
                        return [2 /*return*/];
                    }
                    directiveString = JSON.stringify(directive);
                    hashSignature = (0, helpers_1.signRSASHA256)(directiveString, privateKey);
                    dictionary = (0, helpers_1.convertToDictionaryItemsRepresentation)({
                        sig: hashSignature,
                        keyid: 'main',
                    });
                    signature = (0, structured_headers_1.serializeDictionary)(dictionary);
                    _a.label = 3;
                case 3:
                    form = new form_data_1.default();
                    form.append('directive', JSON.stringify(directive), {
                        contentType: 'application/json',
                        header: __assign({ 'content-type': 'application/json; charset=utf-8' }, (signature ? { 'expo-signature': signature } : {})),
                    });
                    res.statusCode = 200;
                    res.setHeader('expo-protocol-version', 1);
                    res.setHeader('expo-sfv-version', 0);
                    res.setHeader('cache-control', 'private, max-age=0');
                    res.setHeader('content-type', "multipart/mixed; boundary=".concat(form.getBoundary()));
                    res.write(form.getBuffer());
                    res.end();
                    return [2 /*return*/];
            }
        });
    });
}
function putNoUpdateAvailableInResponseAsync(req, res, protocolVersion) {
    return __awaiter(this, void 0, void 0, function () {
        var directive, signature, expectSignatureHeader, privateKey, directiveString, hashSignature, dictionary, form;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (protocolVersion === 0) {
                        throw new Error('NoUpdateAvailable directive not available in protocol version 0');
                    }
                    return [4 /*yield*/, (0, helpers_1.createNoUpdateAvailableDirectiveAsync)()];
                case 1:
                    directive = _a.sent();
                    signature = null;
                    expectSignatureHeader = req.headers['expo-expect-signature'];
                    if (!expectSignatureHeader) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, helpers_1.getPrivateKeyAsync)()];
                case 2:
                    privateKey = _a.sent();
                    if (!privateKey) {
                        res.statusCode = 400;
                        res.json({
                            error: 'Code signing requested but no key supplied when starting server.',
                        });
                        return [2 /*return*/];
                    }
                    directiveString = JSON.stringify(directive);
                    hashSignature = (0, helpers_1.signRSASHA256)(directiveString, privateKey);
                    dictionary = (0, helpers_1.convertToDictionaryItemsRepresentation)({
                        sig: hashSignature,
                        keyid: 'main',
                    });
                    signature = (0, structured_headers_1.serializeDictionary)(dictionary);
                    _a.label = 3;
                case 3:
                    form = new form_data_1.default();
                    form.append('directive', JSON.stringify(directive), {
                        contentType: 'application/json',
                        header: __assign({ 'content-type': 'application/json; charset=utf-8' }, (signature ? { 'expo-signature': signature } : {})),
                    });
                    res.statusCode = 200;
                    res.setHeader('expo-protocol-version', 1);
                    res.setHeader('expo-sfv-version', 0);
                    res.setHeader('cache-control', 'private, max-age=0');
                    res.setHeader('content-type', "multipart/mixed; boundary=".concat(form.getBoundary()));
                    res.write(form.getBuffer());
                    res.end();
                    return [2 /*return*/];
            }
        });
    });
}
