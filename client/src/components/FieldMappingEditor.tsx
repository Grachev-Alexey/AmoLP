import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowRight } from "lucide-react";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

interface FieldMappingEditorProps {
  mappings: FieldMapping[];
  sourceFields: Array<{ id: string; name: string; type?: string }>;
  targetFields: Array<{ id: string; name: string; type?: string; description?: string }>;
  onMappingsChange: (mappings: FieldMapping[]) => void;
  sourceTitle: string;
  targetTitle: string;
}

export default function FieldMappingEditor({
  mappings,
  sourceFields,
  targetFields,
  onMappingsChange,
  sourceTitle,
  targetTitle
}: FieldMappingEditorProps) {
  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: `mapping_${Date.now()}`,
      sourceField: '',
      targetField: ''
    };
    onMappingsChange([...mappings, newMapping]);
  };

  const updateMapping = (id: string, field: 'sourceField' | 'targetField', value: string) => {
    const updatedMappings = mappings.map(mapping => 
      mapping.id === id ? { ...mapping, [field]: value } : mapping
    );
    onMappingsChange(updatedMappings);
  };

  const removeMapping = (id: string) => {
    const updatedMappings = mappings.filter(mapping => mapping.id !== id);
    onMappingsChange(updatedMappings);
  };

  const getFieldInfo = (fields: Array<{ id: string; name: string; type?: string }>, fieldId: string) => {
    return fields.find(field => field.id === fieldId);
  };

  const getUsedSourceFields = () => {
    return mappings.filter(m => m.sourceField).map(m => m.sourceField);
  };

  const getUsedTargetFields = () => {
    return mappings.filter(m => m.targetField).map(m => m.targetField);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Маппинг полей</CardTitle>
          <Button onClick={addMapping} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Добавить поле
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>{sourceTitle}</span>
          </div>
          <ArrowRight className="w-4 h-4" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>{targetTitle}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-4">
              <ArrowRight className="w-8 h-8 mx-auto opacity-50" />
            </div>
            <p className="text-sm">Нет настроенных полей</p>
            <p className="text-xs mt-1">Нажмите "Добавить поле" для создания маппинга</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mappings.map((mapping) => {
              const sourceFieldInfo = getFieldInfo(sourceFields, mapping.sourceField);
              const targetFieldInfo = getFieldInfo(targetFields, mapping.targetField);
              const isComplete = mapping.sourceField && mapping.targetField;
              
              return (
                <div key={mapping.id} className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Источник</div>
                    <Select
                      value={mapping.sourceField}
                      onValueChange={(value) => updateMapping(mapping.id, 'sourceField', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите поле источника" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceFields.map((field) => {
                          const isUsed = getUsedSourceFields().includes(field.id) && field.id !== mapping.sourceField;
                          return (
                            <SelectItem 
                              key={field.id} 
                              value={field.id || "undefined"}
                              disabled={isUsed}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span>{field.name}</span>
                                {field.type && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {field.type}
                                  </Badge>
                                )}
                                {isUsed && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Используется
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Назначение</div>
                    <Select
                      value={mapping.targetField}
                      onValueChange={(value) => updateMapping(mapping.id, 'targetField', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите поле назначения" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetFields.map((field) => {
                          const isUsed = getUsedTargetFields().includes(field.id) && field.id !== mapping.targetField;
                          return (
                            <SelectItem 
                              key={field.id} 
                              value={field.id || "undefined"}
                              disabled={isUsed}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center justify-between w-full">
                                  <span>{field.name}</span>
                                  <div className="flex gap-1">
                                    {field.type && (
                                      <Badge variant="secondary" className="ml-2 text-xs">
                                        {field.type}
                                      </Badge>
                                    )}
                                    {isUsed && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        Используется
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {field.description && (
                                  <span className="text-xs text-muted-foreground mt-1">{field.description}</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isComplete && (
                      <Badge variant="default" className="text-xs">
                        Настроено
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMapping(mapping.id)}
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {mappings.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Статистика маппинга
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium">{mappings.length}</div>
                <div className="text-muted-foreground">Всего полей</div>
              </div>
              <div>
                <div className="font-medium">
                  {mappings.filter(m => m.sourceField && m.targetField).length}
                </div>
                <div className="text-muted-foreground">Настроено</div>
              </div>
              <div>
                <div className="font-medium">
                  {mappings.filter(m => !m.sourceField || !m.targetField).length}
                </div>
                <div className="text-muted-foreground">Не настроено</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}