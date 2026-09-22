# Découverte : plan d'implémentation

Date : 22/09/2026
Statut : validé sur le principe, rien de codé
Le quoi et le pourquoi sont dans `discovery-plan.md`. Ce fichier dit le comment et dans quel ordre.

---

## La règle de travail

Six chantiers. Chacun est autonome, se vérifie tout seul, et se livre avant que le suivant commence.

Jeremy donne le GO entre chaque. Aucun chantier ne démarre sans lui.

---

## Chantier 0 : le canal des voisins est-il vivant

**Coût : une heure, zéro dépense. C'est le seul chantier qui décide des autres.**

### Le problème

Le moteur des vagues est : les qualifiés deviennent les graines, leurs voisins deviennent les candidats. Si les voisins ne reviennent pas, la vague 2 ne fait que relancer les requêtes de la vague 1.

Deux lectures s'opposent. Le pipeline manuel parle d'épuisement de ses graines. Nos runs mesurent un champ vide sur 254 profils jamais vus.

### Ce qu'on fait

1. Reprendre 20 profils déjà payés, de tailles réparties de 20k à 1M, et redemander leur fiche par adresse directe.
2. Compter, pour chacun, si le champ des comptes similaires est présent, et combien de handles il porte.
3. Refaire le même appel avec les réglages d'entrée poussés un par un, pour savoir si un paramètre l'active.
4. Croiser avec la taille de la graine, puisque le manuel mesure 90% de vide sous 100k et 36% au-dessus d'1M.

### Ce qu'on en tire

| résultat | conséquence |
|---|---|
| Le champ revient sur les grosses graines | les vagues ont un moteur, on continue, graines hautes seulement |
| Le champ est vide partout | les vagues n'ont que Google comme moteur, chantier 4 devient bloquant |
| Un réglage l'active | on le met et on continue |

### Vérifié par

Un tableau : taille de la graine, champ présent, nombre de voisins, part de nouveaux. Sur 20 profils.

---

## Chantier 1 : ne jamais payer deux fois

**Aucune dépendance. Gain mesuré : 62% de rachat évité sur un second passage.**

### Trois choses, indépendantes les unes des autres

**1.1 Le rendement par requête.**
Chaque recherche retient ce qu'elle a rendu : profils vus, profils nouveaux, coût. Une requête qui rend zéro nouveau deux fois de suite est retirée de la campagne.

Mesuré : "street interviewer" plafonne à 6 comptes, "challenge creator" à 20. Les relancer à 72 achète 40 comptes déjà connus pour en gagner zéro.

**1.2 Ne jamais racheter un profil mesuré récemment.**
Avant de lancer une recherche de fiches, on retire les handles mesurés il y a moins de 30 jours. Leurs chiffres sont en base et servent tels quels.

La mesure est universelle, le verdict est par campagne. Un profil rejeté par une campagne est réévalué par la suivante, jamais racheté.

**1.3 La fraîcheur.**
Un profil mesuré il y a plus de 30 jours devient un candidat, jamais un verdict. On rachète sa fiche avant de le juger.

Un profil périmé n'est jamais rejeté sur ses vieux chiffres. Il est rafraîchi ou ignoré.

### Vérifié par

Un run sur une campagne existante. Le rapport doit montrer zéro profil racheté, et le nombre de requêtes retirées.

---

## Chantier 2 : les graines

**Dépend de 0 pour son utilité. Peut être construit avant.**

### Quatre choses

**2.1 Obligatoires à la création.**
Une campagne ne se crée plus sans au moins trois comptes exemples. L'écran dit pourquoi : sans eux le meilleur canal ne démarre jamais.

Les deux campagnes créées le 21/09 n'en avaient aucune. Le canal voisins n'a donc jamais tourné.

**2.2 Étalées sur la fourchette.**
Les graines se jugent par rapport à la fenêtre d'abonnés de la campagne, jamais dans l'absolu. Pour 10-100k : viser 20k, 45k, 70k, 100k.

Jamais de graine au plancher. Une graine à 10k suggère des comptes sous 10k, donc hors cible.

L'écran montre où chaque graine tombe dans la fourchette, et signale un trou.

**2.3 Les voisins de nos propres leads.**
Un lead qualifié devient une graine de la campagne. C'est la meilleure graine possible et elle est gratuite, sa fiche est déjà payée.

**2.4 Graines croisées entre campagnes.**
Un créateur qualifié pour une campagne sert de graine à une autre campagne de la même niche. Jamais hors niche.

### Vérifié par

Une campagne créée sans graine doit être refusée. Une campagne avec quatre graines étalées doit montrer sa couverture de fourchette.

---

## Chantier 3 : les vagues

**Dépend de 1. Meilleur avec 0 et 4.**

### Le principe

Un run n'engage plus tout son budget d'un coup. Il avance par vagues, chacune apprenant de la précédente.

| vague | taille | ce qu'elle fait |
|---|---|---|
| 1 | 400 | découverte pure, sur les graines du client |
| 2 | 600 | plus les voisins des qualifiés de la vague 1 |
| 3 et suite | jusqu'à 3000 | les graines s'enrichissent à chaque tour |

### Ce qui est décidé entre deux vagues

- Les requêtes qui ont rendu zéro nouveau sont retirées
- Les qualifiés deviennent des graines
- Le budget restant va vers le canal qui a le mieux visé sur cette campagne
- Le run s'arrête tôt si la cible du jour est atteinte

### Le réglage à trancher, non tranché

Quelle part de chaque vague va aux voisins des bonnes graines, et quelle part à de la découverte neuve.

Départ proposé : 70% voisins, 30% neuf. Rien ne le fonde encore.

Trop peu de sang neuf et le pool converge sur le premier lead qualifié. La cible se rétrécit sans que personne le voie.

Ce réglage se mesure sur trois vagues avant d'être fixé, et il bouge sans doute : beaucoup d'exploration au début, plus d'exploitation quand les graines sont bonnes.

### Vérifié par

Un run de 3000 en vagues contre un run de 3000 d'un coup, sur la même campagne, coût et leads comparés.

---

## Chantier 4 : Google

**Dépend d'une clé de recherche web que nous n'avons pas.**

### Le principe

Chercher `site:instagram.com "<niche>" "Followers"`, par pays et par langue. L'extrait Google affiche le nombre d'abonnés.

On connaît donc la taille avant d'acheter la fiche. On n'achète que ce qui est dans la fourchette.

| | visée |
|---|---|
| Google | 99% |
| Notre recherche par nom de compte | 15% |

### Ce que ça change

Le coût par lead passe de 0,35 $ à environ 0,07 $. C'est la moitié du chemin à lui seul.

### La limite à connaître

Google ne donne que le nombre d'abonnés. Rien sur les vues, la cadence ou la date du dernier post. On supprime 62% du gâchis, pas la totalité.

### Vérifié par

100 pages Google sur une niche connue. Combien de handles sortis, combien dans la fourchette, coût réel par candidat utile.

---

## Chantier 5 : repasser les échecs de peu

**Dépend de 1. Petit chantier.**

Un compte à 9 800 abonnés en aura 10 500 dans deux mois. Un compte inactif depuis 15 jours peut reposter demain.

Les profils qui ratent une règle de peu sont marqués et repassés au bout d'un délai, sans nouvelle découverte. Leur fiche est rachetée, c'est tout.

### Vérifié par

Le nombre de profils repassés et le nombre qui passent au second essai.

---

## L'ordre

| # | chantier | dépend de | bloqué par |
|---|---|---|---|
| 0 | Le canal des voisins | rien | rien |
| 1 | Ne jamais payer deux fois | rien | rien |
| 2 | Les graines | rien pour construire | rien |
| 3 | Les vagues | 1 | rien |
| 4 | Google | rien pour construire | la clé de recherche |
| 5 | Les échecs de peu | 1 | rien |

Le 0 en premier parce qu'il coûte une heure et décide du reste.
Le 1 ensuite parce qu'il rapporte sans rien débloquer.

---

## Ce qui reste hors de ce plan

| sujet | pourquoi |
|---|---|
| Agent navigateur et API interne Instagram | écartés par Jeremy le 22/09 |
| API Meta Business | écartée, deux systèmes de mesure |
| Grand index d'un coup | écarté, capex et fraîcheur |
| Pool partagé ou cloisonné | arbitrage non tranché |
| 50 requêtes au lieu de 8 | à tester, pas encore validé |
| Fiches des marketplaces | à tester |
| Pré-filtre par les likes | à tester |

---

## Blocages en cours

- Apify à 69,81 $ sur un plafond mensuel de 69 $. Aucun run possible avant relèvement.
- Pas de clé de recherche web, ce qui bloque le chantier 4.
