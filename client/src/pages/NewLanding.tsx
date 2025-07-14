import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, BarChart3, Settings, Webhook, FileText, CheckCircle, Users, Clock } from "lucide-react";

export default function NewLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">CRM Integration</h1>
                <p className="text-sm text-muted-foreground">AmoCRM • LPTracker</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/auth'}
                className="text-foreground"
              >
                Войти
              </Button>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Начать работу
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6 border-primary/20 text-primary">
              Автоматизация CRM процессов
            </Badge>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Интеграция{" "}
              <span className="text-primary">AmoCRM</span>
              {" "}и{" "}
              <span className="text-primary">LPTracker</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Создавайте правила синхронизации, автоматизируйте рабочие процессы и управляйте интеграциями в одном месте
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => window.location.href = '/auth'}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Создать аккаунт
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-border text-foreground hover:bg-muted"
              >
                Посмотреть демо
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Все что нужно для интеграции</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Профессиональные инструменты для создания надежных интеграций между CRM системами
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border bg-card">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Конструктор правил</CardTitle>
                <CardDescription>
                  Визуальный редактор для создания сложных правил синхронизации
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Условная логика ЕСЛИ-ТО
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Маппинг полей
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Тестирование правил
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Webhook className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Webhook обработка</CardTitle>
                <CardDescription>
                  Мгновенная реакция на события в реальном времени
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Автоматическое выполнение
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Надежная доставка
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Мониторинг ошибок
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Аналитика</CardTitle>
                <CardDescription>
                  Подробная статистика и мониторинг работы интеграций
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Детальные логи
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Статистика выполнения
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Отчеты по ошибкам
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Как это работает</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Простой процесс настройки интеграции между вашими CRM системами
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">Подключение</h4>
              <p className="text-muted-foreground">
                Подключите ваши AmoCRM и LPTracker аккаунты через безопасные API ключи
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">Настройка</h4>
              <p className="text-muted-foreground">
                Создайте правила синхронизации с помощью интуитивного конструктора
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">Автоматизация</h4>
              <p className="text-muted-foreground">
                Система автоматически синхронизирует данные согласно вашим правилам
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-bold mb-4">Преимущества интеграции</h3>
            <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
              Экономьте время и ресурсы с помощью автоматизации процессов
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-green-500" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold mb-2">Экономия времени</h4>
                  <p className="text-muted-foreground">
                    Автоматизируйте рутинные задачи и освободите время для важных дел
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold mb-2">Надежность</h4>
                  <p className="text-muted-foreground">
                    Исключите человеческие ошибки благодаря автоматической синхронизации
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold mb-2">Единый интерфейс</h4>
                  <p className="text-muted-foreground">
                    Управляйте всеми интеграциями из одного удобного места
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold mb-2">Полный контроль</h4>
                  <p className="text-muted-foreground">
                    Отслеживайте все операции с помощью детальных логов и отчетов
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-3xl font-bold mb-4">
              Начните автоматизировать свою CRM уже сегодня
            </h3>
            <p className="text-muted-foreground mb-8">
              Создайте аккаунт и настройте первую интеграцию за несколько минут
            </p>
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/auth'}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Создать аккаунт бесплатно
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 CRM Integration. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}