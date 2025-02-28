import React, { useState, useEffect } from 'react';
import { Settings, X, ChevronDown, ChevronUp, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './App.css';

// Types
interface Rule {
  id: string;
  title: string;
  definition: string;
  expanded: boolean;
  evaluationResult?: {
    outcome: 'PASS' | 'FAIL' | 'NA' | null;
    justification: string;
  };
  isEvaluating: boolean;
}

function App() {
  // State
  const [rules, setRules] = useState<Rule[]>([]);
  const [subjectMatter, setSubjectMatter] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDefinition, setNewRuleDefinition] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an expert in financial regulation and mortgage applications. Given the following data representing a mortgage application and the provided rule, determine if the application complies with, fails, or does not apply to the rule. Provide a single sentence justification and a PASS/FAIL/NA outcome."
  );
  const [apiKey, setApiKey] = useState('');

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedRules = localStorage.getItem('screeningRules');
    const savedPrompt = localStorage.getItem('systemPrompt');
    const savedApiKey = localStorage.getItem('apiKey');

    if (savedRules) {
      setRules(JSON.parse(savedRules));
    }
    if (savedPrompt) {
      setSystemPrompt(savedPrompt);
    }
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Save rules to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('screeningRules', JSON.stringify(rules));
  }, [rules]);

  // Handle rule reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(rules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setRules(items);
  };

  // Toggle rule expansion
  const toggleRuleExpansion = (id: string) => {
    setRules(
      rules.map((rule) =>
        rule.id === id ? { ...rule, expanded: !rule.expanded } : rule
      )
    );
  };

  // Delete rule
  const deleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  // Add new rule
  const addRule = () => {
    if (newRuleTitle.trim() === '') return;

    const newRule: Rule = {
      id: Date.now().toString(),
      title: newRuleTitle,
      definition: newRuleDefinition,
      expanded: false,
      isEvaluating: false,
    };

    setRules([...rules, newRule]);
    setNewRuleTitle('');
    setNewRuleDefinition('');
  };

  // Save system prompt
  const saveSystemPrompt = () => {
    localStorage.setItem('systemPrompt', systemPrompt);
    alert('System prompt saved!');
  };

  // Save API key
  const saveApiKey = () => {
    localStorage.setItem('apiKey', apiKey);
    alert('API key saved!');
  };

  // Evaluate rule against subject matter
  const evaluateRule = async (rule: Rule) => {
    if (!apiKey) {
      alert('Please set your API key in settings first.');
      return;
    }

    if (!subjectMatter.trim()) {
      alert('Please enter subject matter to evaluate.');
      return;
    }

    console.log(`Evaluating rule: ${rule.title}`);
    
    // Update rule to show loading state
    setRules(
      rules.map((r) =>
        r.id === rule.id ? { ...r, isEvaluating: true } : r
      )
    );

    try {
      const prompt = `Rule: ${rule.title}\nRule Definition: ${rule.definition}\n\nSubject Matter to Evaluate:\n${subjectMatter}\n\nDetermine if the subject matter complies with, fails, or does not apply to the rule. Provide a single sentence justification and end with PASS, FAIL, or NA as the outcome.`;

      console.log('Sending request to LLM API');
      console.log('System prompt:', systemPrompt);
      console.log('User prompt:', prompt);

      const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          model: "gpt-4o",
          temperature: 1,
          max_tokens: 4000,
          top_p: 1
        })
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('API response:', data);
        
        const result = data.choices[0]?.message?.content;
        console.log('Result content:', result);

        // Extract outcome (PASS/FAIL/NA) from the result
        let outcome = null;
        if (result.includes('PASS')) outcome = 'PASS';
        else if (result.includes('FAIL')) outcome = 'FAIL';
        else if (result.includes('NA')) outcome = 'NA';

        // Update the rule with the evaluation result
        setRules(
          rules.map((r) =>
            r.id === rule.id
              ? {
                  ...r,
                  evaluationResult: {
                    outcome,
                    justification: result
                  },
                  isEvaluating: false
                }
              : r
          )
        );
      } else {
        console.error('API request failed:', response.statusText);
        
        // Update rule to show error state
        setRules(
          rules.map((r) =>
            r.id === rule.id
              ? {
                  ...r,
                  evaluationResult: {
                    outcome: null,
                    justification: `Error: ${response.statusText}`
                  },
                  isEvaluating: false
                }
              : r
          )
        );
      }
    } catch (error) {
      console.error('Error evaluating rule:', error);
      
      // Update rule to show error state
      setRules(
        rules.map((r) =>
          r.id === rule.id
            ? {
                ...r,
                evaluationResult: {
                  outcome: null,
                  justification: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                },
                isEvaluating: false
              }
            : r
        )
      );
    }
  };

  // Get outcome color
  const getOutcomeColor = (outcome: string | null) => {
    switch (outcome) {
      case 'PASS':
        return 'bg-green-100 text-green-800';
      case 'FAIL':
        return 'bg-red-100 text-red-800';
      case 'NA':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Screening System</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Rules list */}
        <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Rules</h2>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="rules">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-3"
                >
                  {rules.map((rule, index) => (
                    <Draggable key={rule.id} draggableId={rule.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden"
                        >
                          <div className="p-3 flex items-center justify-between">
                            <div className="flex items-center flex-1">
                              <div
                                {...provided.dragHandleProps}
                                className="mr-2 cursor-grab"
                              >
                                <GripVertical className="h-4 w-4 text-gray-400" />
                              </div>
                              <h3 className="text-sm font-medium text-gray-900 flex-1">{rule.title}</h3>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => evaluateRule(rule)}
                                disabled={rule.isEvaluating}
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50"
                              >
                                {rule.isEvaluating ? 'Evaluating...' : 'Evaluate'}
                              </button>
                              <button
                                onClick={() => toggleRuleExpansion(rule.id)}
                                className="p-1 rounded-full hover:bg-gray-100"
                              >
                                {rule.expanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                )}
                              </button>
                              <button
                                onClick={() => deleteRule(rule.id)}
                                className="p-1 rounded-full hover:bg-gray-100 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4 text-gray-500" />
                              </button>
                            </div>
                          </div>
                          
                          {rule.expanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                              <p className="text-sm text-gray-600 mb-3">{rule.definition}</p>
                            </div>
                          )}
                          
                          {rule.evaluationResult && (
                            <div className={`px-3 py-2 border-t border-gray-100 ${getOutcomeColor(rule.evaluationResult.outcome)}`}>
                              <p className="text-xs">
                                {rule.evaluationResult.justification}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {rules.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No rules added yet. Add rules in the settings panel.</p>
            </div>
          )}
        </div>

        {/* Right panel - Subject matter */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Subject Matter</h2>
          <textarea
            value={subjectMatter}
            onChange={(e) => setSubjectMatter(e.target.value)}
            placeholder="Paste subject matter here for evaluation..."
            className="w-full h-[calc(100vh-12rem)] p-4 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="fixed inset-0 z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowSettings(false)}></div>
            <div className="fixed inset-y-0 right-0 max-w-xl w-full bg-white shadow-xl overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Add rule section */}
                <div className="mb-8">
                  <h3 className="text-md font-medium text-gray-900 mb-3">Add New Rule</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="rule-title" className="block text-sm font-medium text-gray-700 mb-1">
                        Rule Title
                      </label>
                      <input
                        type="text"
                        id="rule-title"
                        value={newRuleTitle}
                        onChange={(e) => setNewRuleTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter rule title"
                      />
                    </div>
                    <div>
                      <label htmlFor="rule-definition" className="block text-sm font-medium text-gray-700 mb-1">
                        Rule Definition
                      </label>
                      <textarea
                        id="rule-definition"
                        value={newRuleDefinition}
                        onChange={(e) => setNewRuleDefinition(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter rule definition"
                      />
                    </div>
                    <button
                      onClick={addRule}
                      disabled={!newRuleTitle.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      Add Rule
                    </button>
                  </div>
                </div>

                {/* System prompt section */}
                <div className="mb-8">
                  <h3 className="text-md font-medium text-gray-900 mb-3">System Prompt</h3>
                  <div className="space-y-4">
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter system prompt for LLM"
                    />
                    <button
                      onClick={saveSystemPrompt}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Save System Prompt
                    </button>
                  </div>
                </div>

                {/* API key section */}
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-3">API Key</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        id="api-key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter your API key"
                      />
                    </div>
                    <button
                      onClick={saveApiKey}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Save API Key
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      Need an API key? Visit the{' '}
                      <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-500"
                      >
                        GitHub tokens page
                      </a>{' '}
                      to generate one.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;