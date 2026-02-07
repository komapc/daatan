'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { ThumbsUp, Lightbulb, ThumbsDown, Reply, Trash2, Edit2, MessageSquare } from 'lucide-react'
import CommentForm from './CommentForm'
import type { Comment } from './CommentThread'

function SimpleAvatar({ user, size = 'sm' }: { user: { name: string | null; image: string | null }; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
  const initial = user.name?.charAt(0)?.toUpperCase() || '?'
  
  if (user.image) {
    return <img src={user.image} alt="" className={`${sizeClass} rounded-full`} />
  }
  
  return (
    <div className={`${sizeClass} rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold`}>
      {initial}
    </div>
  )
}

interface CommentItemProps {
  comment: Comment
  predictionId?: string
  forecastId?: string
  onDeleted: (commentId: string) => void
  isReply?: boolean
}

export default function CommentItem({
  comment,
  predictionId,
  forecastId,
  onDeleted,
  isReply = false,
}: CommentItemProps) {
  const { data: session } = useSession()
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(comment.text)
  const [replies, setReplies] = useState<Comment[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [isLoadingReplies, setIsLoadingReplies] = useState(false)
  const [reactions, setReactions] = useState(comment.reactions)

  const isAuthor = session?.user?.id === comment.author.id

  const reactionCounts = {
    LIKE: reactions.filter(r => r.type === 'LIKE').length,
    INSIGHTFUL: reactions.filter(r => r.type === 'INSIGHTFUL').length,
    DISAGREE: reactions.filter(r => r.type === 'DISAGREE').length,
  }

  const userReaction = reactions.find(r => r.user.id === session?.user?.id)

  const handleReact = async (type: 'LIKE' | 'INSIGHTFUL' | 'DISAGREE') => {
    if (!session) return

    try {
      if (userReaction?.type === type) {
        // Remove reaction
        const response = await fetch(`/api/comments/${comment.id}/react`, {
          method: 'DELETE',
        })
        if (response.ok) {
          setReactions(reactions.filter(r => r.user.id !== session.user.id))
        }
      } else {
        // Add or update reaction
        const response = await fetch(`/api/comments/${comment.id}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
        if (response.ok) {
          const newReaction = await response.json()
          setReactions([
            ...reactions.filter(r => r.user.id !== session.user.id),
            newReaction,
          ])
        }
      }
    } catch (error) {
      console.error('Error reacting:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return

    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        onDeleted(comment.id)
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText }),
      })
      if (response.ok) {
        setIsEditing(false)
        comment.text = editText
      }
    } catch (error) {
      console.error('Error updating comment:', error)
    }
  }

  const loadReplies = async () => {
    if (showReplies) {
      setShowReplies(false)
      return
    }

    setIsLoadingReplies(true)
    try {
      const params = new URLSearchParams({ parentId: comment.id })
      if (predictionId) params.set('predictionId', predictionId)
      if (forecastId) params.set('forecastId', forecastId)

      const response = await fetch(`/api/comments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReplies(data.comments || [])
        setShowReplies(true)
      }
    } catch (error) {
      console.error('Error loading replies:', error)
    } finally {
      setIsLoadingReplies(false)
    }
  }

  const handleReplyAdded = (reply: Comment) => {
    setReplies([reply, ...replies])
    setShowReplyForm(false)
    setShowReplies(true)
    comment._count.replies++
  }

  return (
    <div className={`${isReply ? 'ml-8' : ''}`}>
      <div className="flex gap-3">
        <SimpleAvatar user={comment.author} size="sm" />
        
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">
              {comment.author.name || comment.author.username || 'Anonymous'}
            </span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.updatedAt !== comment.createdAt && (
              <span className="text-gray-400 text-xs">(edited)</span>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditText(comment.text)
                  }}
                  className="px-3 py-1 text-gray-700 text-sm hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-800 whitespace-pre-wrap">{comment.text}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 text-sm">
            {/* Reactions */}
            <button
              onClick={() => handleReact('LIKE')}
              disabled={!session}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                userReaction?.type === 'LIKE'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              <ThumbsUp className="w-4 h-4" />
              {reactionCounts.LIKE > 0 && <span>{reactionCounts.LIKE}</span>}
            </button>

            <button
              onClick={() => handleReact('INSIGHTFUL')}
              disabled={!session}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                userReaction?.type === 'INSIGHTFUL'
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'text-gray-600 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              <Lightbulb className="w-4 h-4" />
              {reactionCounts.INSIGHTFUL > 0 && <span>{reactionCounts.INSIGHTFUL}</span>}
            </button>

            <button
              onClick={() => handleReact('DISAGREE')}
              disabled={!session}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                userReaction?.type === 'DISAGREE'
                  ? 'bg-red-100 text-red-600'
                  : 'text-gray-600 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              <ThumbsDown className="w-4 h-4" />
              {reactionCounts.DISAGREE > 0 && <span>{reactionCounts.DISAGREE}</span>}
            </button>

            {/* Reply */}
            {!isReply && session && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>
            )}

            {/* Edit/Delete */}
            {isAuthor && !isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                predictionId={predictionId}
                forecastId={forecastId}
                parentId={comment.id}
                onCommentAdded={handleReplyAdded}
                onCancel={() => setShowReplyForm(false)}
                placeholder="Write a reply..."
              />
            </div>
          )}

          {/* Show Replies Button */}
          {!isReply && comment._count.replies > 0 && (
            <button
              onClick={loadReplies}
              disabled={isLoadingReplies}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              {isLoadingReplies
                ? 'Loading...'
                : showReplies
                ? 'Hide replies'
                : `Show ${comment._count.replies} ${comment._count.replies === 1 ? 'reply' : 'replies'}`}
            </button>
          )}

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  predictionId={predictionId}
                  forecastId={forecastId}
                  onDeleted={(id) => setReplies(replies.filter(r => r.id !== id))}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
