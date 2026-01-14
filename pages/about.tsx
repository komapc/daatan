import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Coins, 
  Users, 
  Trophy, 
  Target,
  Brain,
  Globe,
  Zap,
  Shield,
  CheckCircle
} from "lucide-react";

export default function About() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Bet Creation",
      description: "Our advanced AI analyzes news articles and generates smart prediction questions with appropriate deadlines and resolution sources.",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      icon: Coins,
      title: "Virtual Token Economy",
      description: "Start with 100 tokens and earn more by making accurate predictions. No real money involved - pure skill-based competition.",
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      icon: Target,
      title: "Skill-Based Predictions",
      description: "Test your knowledge of current events and ability to forecast outcomes. Build your reputation as a top predictor.",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      icon: Users,
      title: "Community Driven",
      description: "Join a community of news enthusiasts and forecasters. See what others are predicting and learn from the best.",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      icon: Shield,
      title: "Fair & Transparent",
      description: "All bets are resolved using verifiable sources. Complete transparency in payouts and resolution processes.",
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      icon: Trophy,
      title: "Leaderboards & Recognition",
      description: "Climb the rankings based on accuracy and winnings. Earn badges and recognition for your forecasting skills.",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    }
  ];

  const howItWorks = [
    {
      step: 1,
      title: "Discover Predictions",
      description: "Browse the feed to find interesting predictions about upcoming news events.",
      icon: Globe
    },
    {
      step: 2,
      title: "Place Your Bet",
      description: "Use your virtual tokens to bet YES or NO on outcomes you feel confident about.",
      icon: Coins
    },
    {
      step: 3,
      title: "Wait for Resolution",
      description: "When the event occurs, bets are resolved using official sources and verifiable information.",
      icon: CheckCircle
    },
    {
      step: 4,
      title: "Earn Rewards",
      description: "Winners split the total token pool proportionally based on their bets. Build your reputation!",
      icon: Trophy
    }
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            News Scoop
          </h1>
          <p className="text-xl text-slate-600 mb-6 max-w-3xl mx-auto">
            The world's first AI-powered prediction market for news events. Test your forecasting skills, 
            compete with others, and build your reputation as a top predictor.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="bg-blue-100 text-blue-800 px-4 py-2 text-sm rounded-full">
              Virtual Tokens Only
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-4 py-2 text-sm rounded-full">
              AI-Powered
            </span>
            <span className="bg-purple-100 text-purple-800 px-4 py-2 text-sm rounded-full">
              Skill-Based
            </span>
          </div>
        </div>

        {/* What is News Scoop */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl text-center">What is News Scoop?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg text-slate-700 leading-relaxed">
              News Scoop is a revolutionary platform that combines artificial intelligence with prediction markets 
              to create an engaging way for news enthusiasts to test their forecasting abilities. Unlike traditional 
              gambling or financial betting, our platform focuses purely on knowledge, analysis, and skill.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  How It Started
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Born from the idea that news readers often have strong opinions about future events, 
                  News Scoop provides a platform to put those predictions to the test. Our AI analyzes 
                  current news articles and creates fair, verifiable prediction questions.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-600" />
                  The Vision
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  We envision a community of informed forecasters who help each other understand complex 
                  world events through collective intelligence. By gamifying predictions, we make learning 
                  about current events more engaging and interactive.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-8">How It Works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item) => (
              <Card key={item.step} className="text-center p-6 hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Key Features */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-8">Key Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-3`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Why Choose News Scoop */}
        <Card className="mb-12 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-8">Why Choose News Scoop?</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">No Real Money Risk</h4>
                    <p className="text-slate-600 text-sm">Play with virtual tokens only - focus on skill, not financial risk.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Educational Value</h4>
                    <p className="text-slate-600 text-sm">Learn about current events while developing analytical thinking skills.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">AI-Assisted</h4>
                    <p className="text-slate-600 text-sm">Advanced AI helps create fair, unbiased prediction questions.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Community Driven</h4>
                    <p className="text-slate-600 text-sm">Connect with like-minded individuals who love analyzing news.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Transparent Process</h4>
                    <p className="text-slate-600 text-sm">All resolutions use verifiable sources and clear documentation.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Skill Building</h4>
                    <p className="text-slate-600 text-sm">Improve your ability to analyze information and make predictions.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Start Predicting?</h2>
            <p className="text-xl mb-6 text-white/90">
              Join our community of forecasters and test your knowledge of current events!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Coins className="w-5 h-5" />
                <span className="font-semibold">Start with 100 Free Tokens</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Users className="w-5 h-5" />
                <span className="font-semibold">Join the Community</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>
            News Scoop is a skill-based prediction platform using virtual tokens only. 
            No real money or gambling is involved.
          </p>
        </div>
      </div>
    </div>
  );
}