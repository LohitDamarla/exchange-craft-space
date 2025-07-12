import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Users, Search, ArrowLeftRight, Star } from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Trade Skills, Build Community
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Connect with others to exchange knowledge and skills. Learn something new while teaching what you know best.
        </p>
        <div className="flex gap-4 justify-center">
          {user ? (
            <Link to="/search">
              <Button size="lg">
                Start Exploring <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <Button size="lg">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <Users className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Create Profile</CardTitle>
            <CardDescription>
              Set up your profile with skills you offer and want to learn
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <Search className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Find Matches</CardTitle>
            <CardDescription>
              Search for people who can teach you what you want to learn
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <ArrowLeftRight className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Exchange Skills</CardTitle>
            <CardDescription>
              Send swap requests and arrange skill exchange sessions
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <Star className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Rate & Review</CardTitle>
            <CardDescription>
              Give feedback and build trust within the community
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Call to Action */}
      {!user && (
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to start learning?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of people exchanging skills and knowledge
          </p>
          <Link to="/register">
            <Button size="lg">
              Sign Up for Free
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default LandingPage;