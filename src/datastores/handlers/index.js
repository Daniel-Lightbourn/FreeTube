let handlers
const usingElectron = window?.process?.type === 'renderer'
if (usingElectron) {
  handlers = require('./electron').default
} else {
  handlers = require('./web').default
}

const DBSettingHandlers = handlers.settings
const DBHistoryHandlers = handlers.history
const DBProfileHandlers = handlers.profiles
const DBPlaylistHandlers = handlers.playlists
const DBCommentHandlers = handlers.comments

export {
  DBSettingHandlers,
  DBHistoryHandlers,
  DBProfileHandlers,
  DBPlaylistHandlers,
  DBCommentHandlers
}
