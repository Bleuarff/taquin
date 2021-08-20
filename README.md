# Taquin

Résolveur d'un casse-tête.

TODO:
- grille 4*5
- each piece modeled by size (1*1, 2*1, 1*2) and position
- set area

How to determine moves?
debut_tour:
- for each piece: check if can move up/left/right/bottom.
-> Store each possible move. Do the first one .

if no possible move: revert last move, use next move on that lap
goto debut_tour
