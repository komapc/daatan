import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  User as UserIcon, 
  TrendingUp, 
  Wallet, 
  History, 
  Award,
  Calendar
} from 'lucide-react'
import PredictionCard from '@/components/predictions/PredictionCard'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/profile')
  }

  // Fetch full user data including stats
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: {
        select: {
          predictions: true,
          commitments: true,
        }
      }
    }
  })

  if (!user) {
    redirect('/')
  }

  // Fetch recent commitments (stakes)
  const commitments = await prisma.commitment.findMany({
    where: { userId: user.id },
    include: {
      prediction: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
              rs: true,
            }
          },
          _count: {
            select: { commitments: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  // Fetch predictions created by user
  const myPredictions = await prisma.prediction.findMany({
    where: { authorId: user.id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          rs: true,
        }
      },
      _count: {
        select: { commitments: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            {user.image ? (
              <img 
                src={user.image} 
                alt={user.name || ''} 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-blue-50"
              />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-blue-100 flex items-center justify-center text-4xl font-black text-blue-600 ring-4 ring-blue-50">
                {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-md border border-gray-50">
              <Award className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{user.name || 'Anonymous'}</h1>
            <p className="text-gray-500 font-medium mb-4">{user.username ? `@${user.username}` : user.email}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Joined</span>
                <span className="text-sm font-bold text-gray-700">{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Predictions</span>
                <span className="text-sm font-bold text-gray-700">{user._count.predictions} created</span>
              </div>
            </div>
          </div>

          <div className="flex flex-row md:flex-col gap-4 w-full md:w-auto">
            <div className="flex-1 bg-blue-600 text-white p-6 rounded-3xl shadow-lg shadow-blue-100 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-blue-200" />
                <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Balance</span>
              </div>
              <p className="text-3xl font-black">{user.cuAvailable} <span className="text-xl font-medium">CU</span></p>
            </div>
            <div className="flex-1 bg-gray-900 text-white p-6 rounded-3xl shadow-lg shadow-gray-200 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Reputation</span>
              </div>
              <p className="text-3xl font-black">{user.rs.toFixed(1)} <span className="text-xl font-medium">RS</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Stakes */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              Recent Stakes
            </h2>
          </div>
          <div className="space-y-4">
            {commitments.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-gray-400 font-medium">No stakes yet</p>
              </div>
            ) : (
              commitments.map((commitment) => (
                <div key={commitment.id} className="relative group">
                  <PredictionCard prediction={commitment.prediction as any} />
                  <div className="absolute top-4 right-12 flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-md transform translate-x-4 -translate-y-2">
                    <Wallet className="w-3 h-3" />
                    Staked {commitment.cuCommitted} CU
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* My Predictions */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-500" />
              My Predictions
            </h2>
          </div>
          <div className="space-y-4">
            {myPredictions.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-gray-400 font-medium">No predictions created yet</p>
              </div>
            ) : (
              myPredictions.map((prediction) => (
                <PredictionCard key={prediction.id} prediction={prediction as any} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
