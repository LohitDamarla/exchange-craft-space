import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface UserSkill {
  id: string;
  skill: Skill;
  skill_type: 'offered' | 'wanted';
}

const SkillsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [newSkillName, setNewSkillName] = useState('');
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserSkills();
      fetchAllSkills();
    }
  }, [user]);

  const fetchUserSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('user_skills')
        .select(`
          id,
          skill_type,
          skills (
            id,
            name,
            category
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      const formattedData = data?.map(item => ({
        id: item.id,
        skill: item.skills as Skill,
        skill_type: item.skill_type as 'offered' | 'wanted'
      })) || [];

      setUserSkills(formattedData);
    } catch (error: any) {
      toast({
        title: "Error loading skills",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('is_approved', true)
        .order('name');

      if (error) throw error;
      setAllSkills(data || []);
    } catch (error: any) {
      console.error('Error fetching skills:', error);
    }
  };

  const addSkill = async (skillType: 'offered' | 'wanted') => {
    if (!newSkillName.trim()) return;

    setAdding(true);
    try {
      // First, check if skill exists or create it
      let skill = allSkills.find(s => s.name.toLowerCase() === newSkillName.toLowerCase());
      
      if (!skill) {
        const { data: newSkill, error: skillError } = await supabase
          .from('skills')
          .insert({ name: newSkillName.trim() })
          .select()
          .single();

        if (skillError) throw skillError;
        skill = newSkill;
        setAllSkills(prev => [...prev, skill!]);
      }

      // Then add user_skill
      const { data, error } = await supabase
        .from('user_skills')
        .insert({
          user_id: user?.id,
          skill_id: skill.id,
          skill_type: skillType
        })
        .select(`
          id,
          skill_type,
          skills (
            id,
            name,
            category
          )
        `)
        .single();

      if (error) throw error;

      const formattedData = {
        id: data.id,
        skill: data.skills as Skill,
        skill_type: data.skill_type as 'offered' | 'wanted'
      };

      setUserSkills(prev => [...prev, formattedData]);
      setNewSkillName('');

      toast({
        title: "Skill added",
        description: `${skill.name} has been added to your ${skillType} skills.`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding skill",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const removeSkill = async (userSkillId: string) => {
    try {
      const { error } = await supabase
        .from('user_skills')
        .delete()
        .eq('id', userSkillId);

      if (error) throw error;

      setUserSkills(prev => prev.filter(skill => skill.id !== userSkillId));

      toast({
        title: "Skill removed",
        description: "The skill has been removed from your profile.",
      });
    } catch (error: any) {
      toast({
        title: "Error removing skill",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const offeredSkills = userSkills.filter(skill => skill.skill_type === 'offered');
  const wantedSkills = userSkills.filter(skill => skill.skill_type === 'wanted');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Skills</h1>
        <p className="text-muted-foreground">
          Manage the skills you offer and want to learn
        </p>
      </div>

      <Tabs defaultValue="offered" className="space-y-4">
        <TabsList>
          <TabsTrigger value="offered">Skills I Offer</TabsTrigger>
          <TabsTrigger value="wanted">Skills I Want</TabsTrigger>
        </TabsList>

        <TabsContent value="offered" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills You Offer</CardTitle>
              <CardDescription>
                Add skills that you can teach or help others with
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a skill you can offer..."
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addSkill('offered');
                    }
                  }}
                />
                <Button 
                  onClick={() => addSkill('offered')} 
                  disabled={adding || !newSkillName.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {offeredSkills.map((userSkill) => (
                  <Badge key={userSkill.id} variant="secondary" className="flex items-center gap-1">
                    {userSkill.skill.name}
                    <button
                      onClick={() => removeSkill(userSkill.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {offeredSkills.length === 0 && (
                  <p className="text-muted-foreground">No skills added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wanted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills You Want to Learn</CardTitle>
              <CardDescription>
                Add skills that you're interested in learning from others
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a skill you want to learn..."
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addSkill('wanted');
                    }
                  }}
                />
                <Button 
                  onClick={() => addSkill('wanted')} 
                  disabled={adding || !newSkillName.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {wantedSkills.map((userSkill) => (
                  <Badge key={userSkill.id} variant="outline" className="flex items-center gap-1">
                    {userSkill.skill.name}
                    <button
                      onClick={() => removeSkill(userSkill.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {wantedSkills.length === 0 && (
                  <p className="text-muted-foreground">No skills added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SkillsPage;