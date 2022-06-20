import { DBCommentHandlers } from '../../../datastores/handlers/index'

const state = {
  videos: [
    /*{
      id: 'example',
      highlighted: []
    }*/
  ]
}

const getters = {
  getHighlightedComments: (state) => (videoId) => state.videos.find(video => video.id === videoId)?.highlighted
}

const actions = {
  async grabHighlightedComments({ commit }) {
    try {
      const db = await DBCommentHandlers.find()
      for (const i in db) {
        const videoId = db[i].videoId
        for (const comment of db[i].highlighted) {
          commit('highlightVideoComment', { videoId, comment })
        }
      }
    } catch (errMessage) {
      console.error(errMessage)
    }
  },

  async highlightVideoComment({ commit }, payload) {
    try {
      const { videoId, comment } = payload
      await DBCommentHandlers.upsertHighlightedComment(videoId, comment)
      commit('highlightVideoComment', payload)
    } catch (errMessage) {
      console.error(errMessage)
    }
  },

  async unhighlightVideoComment({ commit }, payload) {
    try {
      const { videoId, comment } = payload
      await DBCommentHandlers.deleteHighlightedComment(videoId, comment)
      commit('unhighlightVideoComment', payload)
    } catch (errMessage) {
      console.error(errMessage)
    }
  },
}


const mutations = {
  highlightVideoComment(state, { videoId, comment }) {
    const jsonComment = JSON.parse(comment)
    const video = state.videos.find(v => v.id == videoId)
    if (video) {
      const i = video.highlighted.findIndex(e => e.commentId === jsonComment.commentId)
      if (i != -1) {
        video.highlighted[i] = jsonComment
      } else {
        video.highlighted.push(jsonComment)
      }
    } else {
      state.videos.push({ id: videoId, highlighted: [jsonComment] })
    }
  },

  unhighlightVideoComment(state, { videoId, comment }) {
    const jsonComment = JSON.parse(comment)
    let video = state.videos.find(v => v.id == videoId)
    if (video) {
      video.highlighted = video.highlighted.filter(e => e.commentId !== jsonComment.commentId)
    }
  },
  toggleShowReplies(state, { videoId, commentIndex }) {
    let video = state.videos.find(v => v.id == videoId)
    if (video) {
      video.highlighted[commentIndex].showReplies = !video.highlighted[commentIndex].showReplies
    }
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
