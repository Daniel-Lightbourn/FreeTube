import Vue from 'vue'
import { mapActions, mapGetters } from 'vuex'
import FtCard from '../ft-card/ft-card.vue'
import FtLoader from '../../components/ft-loader/ft-loader.vue'
import FtSelect from '../../components/ft-select/ft-select.vue'
import FtTimestampCatcher from '../../components/ft-timestamp-catcher/ft-timestamp-catcher.vue'
import autolinker from 'autolinker'
import ytcm from '@freetube/yt-comment-scraper'

export default Vue.extend({
  name: 'WatchVideoComments',
  components: {
    'ft-card': FtCard,
    'ft-loader': FtLoader,
    'ft-select': FtSelect,
    'ft-timestamp-catcher': FtTimestampCatcher
  },
  props: {
    id: {
      type: String,
      required: true
    },
    channelName: {
      type: String,
      required: true
    },
    channelThumbnail: {
      type: String,
      required: true
    }
  },
  data: function () {
    return {
      isLoading: false,
      showComments: false,
      commentScraper: null,
      nextPageToken: null,
      commentData: [],
      highlightedCommentData: [],
      sortNewest: false,
      commentProcess: null,
      sortingChanged: false
    }
  },
  computed: {
    ...mapGetters([
      'getHighlightedComments'
    ]),

    isDev: function () {
      return process.env.NODE_ENV === 'development'
    },

    backendPreference: function () {
      return this.$store.getters.getBackendPreference
    },

    backendFallback: function () {
      return this.$store.getters.getBackendFallback
    },

    currentInvidiousInstance: function () {
      return this.$store.getters.getCurrentInvidiousInstance
    },
    hideCommentLikes: function () {
      return this.$store.getters.getHideCommentLikes
    },

    sortNames: function () {
      return [
        this.$t('Comments.Top comments'),
        this.$t('Comments.Newest first')
      ]
    },

    sortValues: function () {
      return [
        'top',
        'newest'
      ]
    },

    currentSortValue: function () {
      return (this.sortNewest) ? 'newest' : 'top'
    }
  },

  beforeDestroy: function () {
    if (this.commentProcess !== null) {
      this.commentProcess.send('end')
    }
  },
  methods: {
    onTimestamp: function (timestamp) {
      this.$emit('timestamp-event', timestamp)
    },

    handleSortChange: function (sortType) {
      this.sortNewest = !this.sortNewest
      switch (this.backendPreference) {
        case 'local':
          this.isLoading = true
          this.commentData = []
          this.nextPageToken = undefined
          this.getCommentDataLocal({
            videoId: this.id,
            setCookie: false,
            sortByNewest: this.sortNewest,
            continuation: this.nextPageToken ? this.nextPageToken : undefined
          })
          break
        case 'invidious':
          this.isLoading = true
          this.commentData = []
          this.getCommentDataInvidious({
            resource: 'comments',
            id: this.id,
            params: {
              continuation: this.nextPageToken,
              sort_by: this.sortNewest ? 'new' : 'top'
            }
          })
          break
      }
    },

    getCommentData: function () {
      this.isLoading = true


      this.highlightedCommentData = this.getHighlightedComments(this.id)
      console.log(this.highlightedCommentData)

      switch (this.backendPreference) {
        case 'local':
          this.getCommentDataLocal({
            videoId: this.id,
            setCookie: false,
            sortByNewest: this.sortNewest,
            continuation: this.nextPageToken ? this.nextPageToken : undefined
          })
          break
        case 'invidious':
          this.getCommentDataInvidious({
            resource: 'comments',
            id: this.id,
            params: {
              continuation: this.nextPageToken,
              sort_by: this.sortNewest ? 'new' : 'top'
            }
          })
          break
      }
    },

    getMoreComments: function () {
      if (this.commentData.length === 0 || this.nextPageToken === null || typeof this.nextPageToken === 'undefined') {
        this.showToast({
          message: this.$t('Comments.There are no more comments for this video')
        })
      } else {
        this.getCommentData()
      }
    },

    toggleCommentReplies: function (index) {
      if (this.commentData[index].showReplies || this.commentData[index].replies.length > 0) {
        this.commentData[index].showReplies = !this.commentData[index].showReplies
      } else {
        this.getCommentReplies(index)
      }
    },

    toggleHighlightReplies: function(index) {
      if (this.highlightedCommentData[index].showReplies || this.highlightedCommentData[index].replies.length > 0) {
        this.highlightedCommentData[index].showReplies = !this.highlightedCommentData[index].showReplies
      } else {
        this.getCommentReplies(index, true)
      }
    },

    getCommentReplies: function(index, isHighlighted = false) {
      switch (this.commentData[index].dataType) {
        case 'local':
          this.getCommentRepliesLocal({
            videoId: this.id,
            setCookie: false,
            sortByNewest: this.sortNewest,
            replyToken: isHighlighted ? this.highlightedCommentData[index].replyToken : this.commentData[index].replyToken,
            index: index
          }, isHighlighted)
          break
        case 'invidious':
          this.getCommentRepliesInvidious(index, isHighlighted)
          break
      }
    },

    getCommentDataLocal: function (payload) {
      ytcm.getComments(payload)
        .then((response) => {
        this.parseLocalCommentData(response, null)
        })
        .catch((err) => {
        console.log(err)
        const errorMessage = this.$t('Local API Error (Click to copy)')
        this.showToast({
          message: `${errorMessage}: ${err}`,
          time: 10000,
          action: () => {
            navigator.clipboard.writeText(err)
          }
        })
        if (this.backendFallback && this.backendPreference === 'local') {
          this.showToast({
            message: this.$t('Falling back to Invidious API')
          })
          this.getCommentDataInvidious({
            resource: 'comments',
            id: this.id,
            params: {
              continuation: this.nextPageToken,
              sort_by: this.sortNewest ? 'new' : 'top'
            }
          })
        } else {
          this.isLoading = false
        }
      })
    },

    getCommentRepliesLocal: function(payload, isHighlighted = false) {
      this.showToast({
        message: this.$t('Comments.Getting comment replies, please wait')
      })

      ytcm.getCommentReplies(payload)
        .then((response) => {
          this.parseLocalCommentData(response, payload.index, isHighlighted = false)
        })
        .catch((err) => {
        console.log(err)
        const errorMessage = this.$t('Local API Error (Click to copy)')
        this.showToast({
          message: `${errorMessage}: ${err}`,
          time: 10000,
          action: () => {
            navigator.clipboard.writeText(err)
          }
        })
        if (this.backendFallback && this.backendPreference === 'local') {
          this.showToast({
            message: this.$t('Falling back to Invidious API')
          })
          this.getCommentDataInvidious({
            resource: 'comments',
            id: this.id,
            params: {
              continuation: this.nextPageToken,
              sort_by: this.sortNewest ? 'new' : 'top'
            }
          })
        } else {
          this.isLoading = false
        }
      })
    },

    parseLocalCommentData: function(response, index = null, isHighlighted = false) {
      const commentData = response.comments.map((comment) => {
        comment.authorLink = comment.authorId
        comment.showReplies = false
        comment.authorThumb = comment.authorThumb[0].url
        comment.replies = []
        comment.dataType = 'local'
        this.toLocalePublicationString({
          publishText: (comment.time + ' ago'),
          templateString: this.$t('Video.Publicationtemplate'),
          timeStrings: this.$t('Video.Published'),
          liveStreamString: this.$t('Video.Watching'),
          upcomingString: this.$t('Video.Published.Upcoming'),
          isLive: false,
          isUpcoming: false,
          isRSS: false
          })
          .then((data) => {
          comment.time = data
          })
          .catch((error) => {
          console.error(error)
        })
        if (this.hideCommentLikes) {
          comment.likes = null
        }
        comment.text = autolinker.link(comment.text.replace(/(<(?!br>)([^>]+)>)/ig, ''))
        if (comment.customEmojis.length > 0) {
          comment.customEmojis.forEach(emoji => {
            comment.text = comment.text.replace(emoji.text, `<img width="14" height="14" class="commentCustomEmoji" alt="${emoji.text.substring(2, emoji.text.length - 1)}" src="${emoji.emojiThumbnails[0].url}">`)
          })
        }

        return comment
      })

      if (index !== null) {
        if (isHighlighted) {
        if (this.commentData[index].replies.length === 0 || this.commentData[index].replies[this.commentData[index].replies.length - 1].commentId !== commentData[commentData.length - 1].commentId) {
          this.commentData[index].replies = this.commentData[index].replies.concat(commentData)
          this.commentData[index].replyToken = response.continuation
          this.commentData[index].showReplies = true
        }
        } else {
          if (this.highlightedCommentData[index].replies.length === 0 || this.highlightedCommentData[index].replies[this.highlightedCommentData[index].replies.length - 1].commentId !== commentData[commentData.length - 1].commentId) {
            this.highlightedCommentData[index].replies = this.highlightedCommentData[index].replies.concat(commentData)
            this.highlightedCommentData[index].replyToken = response.continuation
            this.highlightedCommentData[index].showReplies = true
          }
        }
      } else {
        if (this.sortingChanged) {
          this.commentData = []
          this.sortingChanged = false
        }
        this.commentData = this.commentData.concat(commentData)
        this.isLoading = false
        this.showComments = true
        this.nextPageToken = response.continuation
      }
    },

    getCommentDataInvidious: function (payload) {
      this.invidiousAPICall(payload)
        .then((response) => {
        const commentData = response.comments.map((comment) => {
          comment.showReplies = false
          comment.authorLink = comment.authorId
          comment.authorThumb = comment.authorThumbnails[1].url.replace('https://yt3.ggpht.com', `${this.currentInvidiousInstance}/ggpht/`)
          if (this.hideCommentLikes) {
            comment.likes = null
          } else {
            comment.likes = comment.likeCount
          }
          comment.text = autolinker.link(comment.content.replace(/(<(?!br>)([^>]+)>)/ig, ''))
          comment.dataType = 'invidious'
          comment.isOwner = comment.authorIsChannelOwner

          if (typeof (comment.replies) !== 'undefined' && typeof (comment.replies.replyCount) !== 'undefined') {
            comment.numReplies = comment.replies.replyCount
            comment.replyContinuation = comment.replies.continuation
          } else {
            comment.numReplies = 0
            comment.replyContinuation = ''
          }

          comment.replies = []

          comment.time = comment.publishedText

          return comment
        })

        this.commentData = this.commentData.concat(commentData)
        this.nextPageToken = response.continuation
        this.isLoading = false
        this.showComments = true
        })
        .catch((xhr) => {
        console.log('found an error')
        console.log(xhr)
        const errorMessage = this.$t('Invidious API Error (Click to copy)')
        this.showToast({
          message: `${errorMessage}: ${xhr.responseText}`,
          time: 10000,
          action: () => {
            navigator.clipboard.writeText(xhr.responseText)
          }
        })
        if (this.backendFallback && this.backendPreference === 'invidious') {
          this.showToast({
            message: this.$t('Falling back to local API')
          })
          this.getCommentDataLocal()
        } else {
          this.isLoading = false
        }
      })
    },

    getCommentRepliesInvidious: function(index, isHighlighted = false) {
      this.showToast({
        message: this.$t('Comments.Getting comment replies, please wait')
      })
      const payload = {
        resource: 'comments',
        id: this.id,
        params: {
          continuation: isHighlighted ? this.highlightedCommentData[index].replyContinuation : this.commentData[index].replyContinuation
        }
      }

      this.invidiousAPICall(payload)
        .then((response) => {
        const commentData = response.comments.map((comment) => {
          comment.showReplies = false
          comment.authorLink = comment.authorId
          comment.authorThumb = comment.authorThumbnails[1].url.replace('https://yt3.ggpht.com', `${this.currentInvidiousInstance}/ggpht/`)
          if (this.hideCommentLikes) {
            comment.likes = null
          } else {
            comment.likes = comment.likeCount
          }
          comment.text = autolinker.link(comment.content.replace(/(<(?!br>)([^>]+)>)/ig, ''))
          comment.time = comment.publishedText
          comment.dataType = 'invidious'
          comment.numReplies = 0
          comment.replyContinuation = ''
          comment.replies = []

          return comment
        })

          if (isHighlighted) {
            this.highlightedCommentData[index].replies = commentData
            this.highlightedCommentData[index].showReplies = true
          } else {
        this.commentData[index].replies = commentData
        this.commentData[index].showReplies = true
          }
        this.isLoading = false
        })
        .catch((xhr) => {
        console.log('found an error')
        console.log(xhr)
        const errorMessage = this.$t('Invidious API Error (Click to copy)')
        this.showToast({
          message: `${errorMessage}: ${xhr.responseText}`,
          time: 10000,
          action: () => {
            navigator.clipboard.writeText(xhr.responseText)
          }
        })
        this.isLoading = false
      })
    },

    getLeanComment: function(comment) {
      let commentLean = {}

      commentLean.verified = comment.verified
      commentLean.author = comment.author
      commentLean.authorThumbnails = comment.authorThumbnails
      commentLean.authorId = comment.authorId
      commentLean.authorUrl = comment.authorUrl
      commentLean.isEdited = comment.isEdited
      commentLean.text = comment.text
      commentLean.published = comment.published
      commentLean.commentId = comment.commentId
      commentLean.authorIsChannelOwner = comment.authorIsChannelOwner
      commentLean.authorThumb = comment.authorThumb
      commentLean.authorLink = comment.authorLink
      commentLean.isMember = comment.isMember
      commentLean.memberIconUrl = comment.memberIconUrl

      return commentLean
    },

    highlightComment: function(index) {
      this.showToast({
        message: "highlight comment " + this.id
      })
      let commentStore = this.getLeanComment(this.commentData[index])

      this.highlightVideoComment({ videoId: `${this.id}`, comment: `${JSON.stringify(commentStore)}` });
      this.highlightedCommentData.push(commentStore)
    },

    highlightCommentReply: function(index, replyIndex) {
      this.showToast({
        message: "highlight replay"
      })
    },

    unhighlightComment: function(comment) {
      this.showToast({
        message: "unhighlight comment"
      })
      this.unhighlightVideoComment({ videoId: `${this.id}`, comment: `${JSON.stringify(comment)}` });
      this.highlightedCommentData = this.highlightedCommentData.filter((e) => e.commentId != comment.commentId)
    },

    goToChannel: function (channelId) {
      this.$router.push({ path: `/channel/${channelId}` })
    },

    ...mapActions([
      'showToast',
      'highlightVideoComment',
      'unhighlightVideoComment',
      'toLocalePublicationString',
      'invidiousAPICall'
    ])
  }
})
