"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = exports.SessionStatus = void 0;
var SessionStatus;
(function (SessionStatus) {
    SessionStatus["Active"] = "active";
    SessionStatus["Stopped"] = "stopped";
})(SessionStatus || (exports.SessionStatus = SessionStatus = {}));
var MessageType;
(function (MessageType) {
    MessageType["User"] = "user";
    MessageType["Assistant"] = "assistant";
    MessageType["System"] = "system";
})(MessageType || (exports.MessageType = MessageType = {}));
//# sourceMappingURL=types.js.map