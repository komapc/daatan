'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, Loader2 } from 'lucide-react'
import CommentItem from './CommentItem'
import CommentForm from './CommentForm'

export interface Comment {
  id: string
  text: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  author: {
    id: string
    name: string | null
    username: string | null
    image: string | null
    rs: number
  }
  reactions: Array<{
    id: string
    type: 'LIKE' | 'INSIGHTFUL' | 'DISAGREE'
    user: {
      id: string
      name: string | null
      username: string | null
    }
  }>
  _count: {
    replies: number
  }
}

interface CommentThreadProps {
  predictionId?: string
  forecastId?: string
}

export default function CommentThread({ predictionId, forecastId }: CommentThreadProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const params = new URLSearchParams()
        if (predictionId) params.set('predictionId', predictionId)
        if (forecastId) params.set('forecastId', forecastId)
        
        const response = await fetch(`/api/comments?${params}`)
        if (response.ok) {
          const data = await response.json()
          setComments(data.comments || [])
        }
      } catch (error) {
        console.error('Error fetching comments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
  }, [predictionId, forecastId])

  const handleCommentAdded = (newComment: Comment) => {
    setComments([newComment, ...comments])
  }

  const handleCommentDeleted = (commentId: string) => {
    setComments(comments.filter(c => c.id !== commentId))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">
          Discussion ({comments.length})
        </h3>
      </div>

      {/* Comment Form */}
      {session && (
        <CommentForm
          predictionId={predictionId}
          forecastId={forecastId}
          onCommentAdded={handleCommentAdded}
        />
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              predictionId={predictionId}
              forecastId={forecastId}
              onDeleted={handleCommentDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
